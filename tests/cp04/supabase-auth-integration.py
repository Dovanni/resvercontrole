import json,os,subprocess,urllib.request,urllib.error,uuid
BASE="http://127.0.0.1:54321"
ANON=os.environ["CP04_ANON_KEY"]
def http(path,method="GET",body=None,token=None):
    data=None if body is None else json.dumps(body).encode()
    headers={"apikey":ANON,"Content-Type":"application/json"}
    if token: headers["Authorization"]="Bearer "+token
    req=urllib.request.Request(BASE+path,data=data,headers=headers,method=method)
    try:
        with urllib.request.urlopen(req,timeout=20) as res:
            raw=res.read()
            return res.status,(json.loads(raw) if raw.strip() else None)
    except urllib.error.HTTPError as e:
        raw=e.read()
        return e.code,(json.loads(raw) if raw.strip() else None)
def sql(query):
    subprocess.run(["psql","postgresql://postgres:postgres@127.0.0.1:54322/postgres","-v","ON_ERROR_STOP=1","-c",query],check=True,stdout=subprocess.DEVNULL)
def register(label):
    email=f"cp04-{label}-{uuid.uuid4().hex[:10]}@example.test"
    code,result=http("/auth/v1/signup","POST",{"email":email,"password":"CP04_test_password_123!"})
    assert code in (200,201) and result.get("access_token"),(code,result)
    return result["user"]["id"],result["access_token"]
owner,owner_token=register("owner")
sales,sales_token=register("sales")
outsider,outsider_token=register("outsider")
company="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
other="cccccccc-cccc-4ccc-8ccc-cccccccccccc"
selected="00000000-0000-4000-8000-000000000001"
series="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
sql(f"""INSERT INTO public.user_company_access(user_id,empresa_id,status,role) VALUES
('{owner}','{company}','active','financeiro'),
('{sales}','{company}','active','vendedor');
INSERT INTO public.payables(id,empresa_id,user_id,series_id,series_index,series_total,amount,due_date,status)
VALUES('{selected}','{company}','{owner}','{series}',1,2,94.47,'2026-01-31','pendente'),
('00000000-0000-4000-8000-000000000002','{company}','{owner}','{series}',2,2,94.47,'2026-02-28','pendente');""")
# An authenticated sales user must not write even an OWN payable in a company
# where membership is active. Test the direct REST Data API, not only the RPC.
sales_row={"empresa_id":company,"user_id":sales,"amount":10,"due_date":"2026-11-01","status":"pendente","recurrence":"nenhuma"}
status,result=http("/rest/v1/payables","POST",sales_row,sales_token)
assert status>=400,(status,result)
# An owner with a financial role may create an own payable.
owner_row={**sales_row,"user_id":owner}
status,result=http("/rest/v1/payables","POST",owner_row,owner_token)
assert status in (200,201,204),(status,result)
# Independent companies: each financial administrator may write only inside
# their own active company and cannot impersonate another owner.
admin,admin_token=register("other-company-admin")
sql(f"INSERT INTO public.user_company_access(user_id,empresa_id,status,role) VALUES ('{admin}','{other}','active','admin')")
admin_row={**owner_row,"user_id":admin,"empresa_id":other,"id":str(uuid.uuid4())}
status,result=http("/rest/v1/payables","POST",admin_row,admin_token)
assert status in (200,201,204),("other-company-admin-insert",status,result)
# Active financial owner can update and delete a dedicated own row.
own_id=str(uuid.uuid4())
own_row={**owner_row,"id":own_id}
status,result=http("/rest/v1/payables","POST",own_row,owner_token)
assert status in (200,201,204),("finance-insert",status,result)
status,result=http("/rest/v1/payables?id=eq."+own_id,"PATCH",{"amount":11},owner_token)
assert status in (200,204),("finance-update",status,result)
status,result=http("/rest/v1/payables?id=eq."+own_id,"DELETE",None,owner_token)
assert status in (200,204),("finance-delete",status,result)
# A seller may not modify or delete their own rows, even if inserted by a
# privileged fixture writer. An unauthorized UPDATE can return 204 with zero
# affected rows; verify via an owner-independent SQL read afterwards.
sales_id=str(uuid.uuid4())
sql(f"INSERT INTO public.payables(id,empresa_id,user_id,amount,due_date,status,recurrence) VALUES ('{sales_id}','{company}','{sales}',10,'2026-11-01','pendente','nenhuma')")
status,result=http("/rest/v1/payables?id=eq."+sales_id,"PATCH",{"amount":99},sales_token)
assert status in (200,204,403,401),("sales-update",status,result)
status,rows=http("/rest/v1/payables?select=amount&id=eq."+sales_id,token=sales_token)
assert status==200 and len(rows)==1 and float(rows[0]["amount"])==10,("sales-update-bypassed",status,rows)
status,result=http("/rest/v1/payables?id=eq."+sales_id,"DELETE",None,sales_token)
assert status in (200,204,403,401),("sales-delete",status,result)
status,rows=http("/rest/v1/payables?select=id&id=eq."+sales_id,token=sales_token)
assert status==200 and len(rows)==1,("sales-delete-bypassed",status,rows)
# Cross-company insertion must be rejected even for active financial members.
cross={**owner_row,"id":str(uuid.uuid4()),"empresa_id":other}
status,result=http("/rest/v1/payables","POST",cross,owner_token)
assert status>=400,("cross-company-insert",status,result)
# RLS must hide the other company's financial data.
status,rows=http("/rest/v1/payables?select=id&id=eq."+admin_row["id"],token=owner_token)
assert status==200 and rows==[],("cross-company-read",status,rows)
# A financial admin of company B must not edit/delete company A's records.
status,result=http("/rest/v1/payables?id=eq."+selected,"PATCH",{"amount":999},admin_token)
assert status in (200,204,403,401),("cross-company-update",status,result)
status,rows=http("/rest/v1/payables?select=amount&id=eq."+selected,token=owner_token)
assert status==200 and len(rows)==1 and float(rows[0]["amount"])==94.47,("cross-company-update-bypassed",status,rows)
status,result=http("/rest/v1/payables?id=eq."+selected,"DELETE",None,admin_token)
assert status in (200,204,403,401),("cross-company-delete",status,result)
status,rows=http("/rest/v1/payables?select=id&id=eq."+selected,token=owner_token)
assert status==200 and len(rows)==1,("cross-company-delete-bypassed",status,rows)
def snapshot(token):
    status,rows=http("/rest/v1/payables?select=id,series_index,amount,due_date,status,paid_amount,paid_at&series_id=eq."+series+"&order=series_index.asc",token=token)
    assert status==200,(status,rows)
    return [{k:r[k] for k in ("id","amount","due_date","status","paid_amount","paid_at")} for r in rows]
snap=snapshot(owner_token)
assert len(snap)==2,snap
args={"p_empresa_id":company,"p_payable_id":selected,"p_scope":"all","p_new_amount":100,"p_anchor_due_date":"2026-01-31","p_expected_snapshot":snap}
for name,token in (("anonymous",None),("outsider",outsider_token),("sales",sales_token)):
    status,result=http("/rest/v1/rpc/edit_payables_series_cp04","POST",args,token)
    assert status>=400,(name,status,result)
status,result=http("/rest/v1/rpc/edit_payables_series_cp04","POST",args,owner_token)
assert status==200 and len(result)==2,(status,result)
assert sum(float(x["old_amount"]) for x in result)==188.94,result
assert sum(float(x["new_amount"]) for x in result)==200,result
assert [x["new_due_date"] for x in result]==["2026-01-31","2026-02-28"],result
status,result=http("/rest/v1/rpc/edit_payables_series_cp04","POST",args,owner_token)
assert status>=400,(status,result)
# Snapshot must include a settled row with a real timestamp. The old JSON
# snapshot must fail after any payment, even when the target is another row.
sql(f"UPDATE public.payables SET status='pago',paid_amount=100,paid_at='2026-10-22 19:30:15.123456+00' WHERE id='00000000-0000-4000-8000-000000000002'")
status,result=http("/rest/v1/rpc/edit_payables_series_cp04","POST",args,owner_token)
assert status>=400,(status,result)
paid_snap=snapshot(owner_token)
assert paid_snap[1]["paid_at"] is not None,paid_snap
args["p_expected_snapshot"]=paid_snap
status,result=http("/rest/v1/rpc/edit_payables_series_cp04","POST",args,owner_token)
assert status==200 and len(result)==1,(status,result)
sql(f"UPDATE public.user_company_access SET status='inactive' WHERE user_id='{owner}'")
# Revocation must also block direct INSERT/UPDATE/DELETE, not only the RPC.
status,result=http("/rest/v1/payables","POST",{**owner_row,"id":str(uuid.uuid4())},owner_token)
assert status>=400,("revoked-insert",status,result)
status,result=http("/rest/v1/payables?id=eq."+selected,"PATCH",{"amount":777},owner_token)
assert status in (200,204,401,403),("revoked-update",status,result)
status,rows=http("/rest/v1/payables?select=amount&id=eq."+selected,token=owner_token)
assert status==200 and len(rows)==1 and float(rows[0]["amount"])==100,("revoked-update-bypassed",status,rows)
status,result=http("/rest/v1/payables?id=eq."+selected,"DELETE",None,owner_token)
assert status in (200,204,401,403),("revoked-delete",status,result)
status,rows=http("/rest/v1/payables?select=id&id=eq."+selected,token=owner_token)
assert status==200 and len(rows)==1,("revoked-delete-bypassed",status,rows)
args["p_expected_snapshot"]=snapshot(owner_token)
status,result=http("/rest/v1/rpc/edit_payables_series_cp04","POST",args,owner_token)
assert status>=400,(status,result)
print("REAL SUPABASE AUTH JWT + RLS + ROLE + REVOKED MEMBERSHIP + STALE SNAPSHOT PASSED")
