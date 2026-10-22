import json,os,subprocess,urllib.request,urllib.error,uuid
BASE="http://127.0.0.1:54321"
ANON=os.environ["CP04_ANON_KEY"]
def http(path,method="GET",body=None,token=None):
    data=None if body is None else json.dumps(body).encode()
    headers={"apikey":ANON,"Content-Type":"application/json"}
    if token: headers["Authorization"]="Bearer "+token
    req=urllib.request.Request(BASE+path,data=data,headers=headers,method=method)
    try:
        with urllib.request.urlopen(req,timeout=20) as res: return res.status,json.load(res)
    except urllib.error.HTTPError as e: return e.code,json.loads(e.read().decode())
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
sql(f"UPDATE public.user_company_access SET status='inactive' WHERE user_id='{owner}'")
args["p_expected_snapshot"]=snapshot(owner_token)
status,result=http("/rest/v1/rpc/edit_payables_series_cp04","POST",args,owner_token)
assert status>=400,(status,result)
print("REAL SUPABASE AUTH JWT + RLS + ROLE + REVOKED MEMBERSHIP + STALE SNAPSHOT PASSED")
