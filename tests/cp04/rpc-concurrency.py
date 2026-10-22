import os, threading, time
import psycopg2
from psycopg2.extras import Json
DSN = "host=localhost dbname=cp04_synthetic user=cp04 password=cp04_only_ephemeral"
USER="11111111-1111-4111-8111-111111111111"
COMPANY="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
SELECTED="00000000-0000-4000-8000-000000000001"
SQL="SELECT * FROM public.edit_payables_series_cp04(%s,%s,%s,%s,%s,%s)"
def connect():
    c=psycopg2.connect(DSN)
    c.autocommit=False
    return c
def snapshot(c):
    with c.cursor() as q:
        q.execute("""SELECT jsonb_agg(jsonb_build_object(
        'id',id,'amount',amount,'due_date',due_date,
        'status',status,'paid_amount',paid_amount,'paid_at',paid_at)
        ORDER BY series_index) FROM public.payables WHERE series_id=
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'""")
        return q.fetchone()[0]
def as_user(q):
    q.execute("SET LOCAL ROLE authenticated")
    q.execute("SELECT set_config('request.jwt.claim.sub',%s,true)",(USER,))
admin=connect()
snap=snapshot(admin)
admin.commit();admin.close()
started=threading.Event(); errors=[]
def writer():
    c=connect()
    try:
        with c.cursor() as q:
            as_user(q)
            q.execute(SQL,(COMPANY,SELECTED,"all",100,"2026-01-31",Json(snap)))
            returned=q.fetchall()
            assert len(returned)==3,returned
            assert sorted(float(row[1]) for row in returned)==[94.47]*3,returned
            assert sorted(float(row[2]) for row in returned)==[100.0]*3,returned
            assert round(sum(float(row[1]) for row in returned),2)==283.41
            assert round(sum(float(row[2]) for row in returned),2)==300.00
            assert round(sum(float(row[2])-float(row[1]) for row in returned),2)==16.59
            started.set()
            time.sleep(2)
        c.commit()
    except Exception as e:
        errors.append(("writer",str(e)));started.set();c.rollback()
    finally:c.close()
def stale_writer():
    assert started.wait(15)
    c=connect()
    try:
        with c.cursor() as q:
            as_user(q)
            q.execute("SET LOCAL lock_timeout='10s'")
            q.execute(SQL,(COMPANY,SELECTED,"all",150,"2026-01-31",Json(snap)))
            q.fetchall()
        c.commit()
        errors.append(("stale writer","unexpected success"))
    except psycopg2.Error as e:
        c.rollback()
        if "Confirmation expired" not in str(e):
            errors.append(("stale writer",str(e)))
    finally:c.close()
a=threading.Thread(target=writer);b=threading.Thread(target=stale_writer)
a.start();b.start();a.join(25);b.join(25)
assert not a.is_alive() and not b.is_alive(), "deadlock"
assert not errors, errors
c=connect()
with c.cursor() as q:
    q.execute("SELECT array_agg(amount ORDER BY series_index), array_agg(due_date ORDER BY series_index) FROM public.payables WHERE series_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'")
    amounts,dates=q.fetchone()
    assert list(map(float,amounts))==[100,100,100],amounts
    assert list(map(str,dates))==["2026-01-31","2026-02-28","2026-03-31"],dates
    as_user(q)
    try:
        q.execute(SQL,("cccccccc-cccc-4ccc-8ccc-cccccccccccc",SELECTED,"all",200,"2026-01-31",Json(snap)))
        raise AssertionError("cross-company call unexpectedly succeeded")
    except psycopg2.Error:
        c.rollback()
c.close()
print("CP04 ACTUAL RPC CONCURRENCY + STALE SNAPSHOT PASSED")

# Paid installment protection and whole-transaction rollback.
c=connect()
with c.cursor() as q:
    q.execute("UPDATE public.payables SET status='pago',paid_amount=100,paid_at='2026-03-31T12:00:00Z' WHERE id='00000000-0000-4000-8000-000000000003'")
c.commit()
paid_snapshot=snapshot(c)
with c.cursor() as q:
    as_user(q)
    q.execute(SQL,(COMPANY,SELECTED,"all",110,"2026-01-31",Json(paid_snapshot)))
    result=q.fetchall()
    assert len(result)==2,result
c.rollback()  # Explicit client transaction rollback after RPC returns.
with c.cursor() as q:
    q.execute("SELECT array_agg(amount ORDER BY series_index),array_agg(status ORDER BY series_index) FROM public.payables WHERE series_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'")
    amounts,statuses=q.fetchone()
    assert list(map(float,amounts))==[100,100,100],amounts
    assert statuses==["pendente","pendente","pago"],statuses
c.close()
print("CP04 PAID-INSTALLMENT PROTECTION + CLIENT ROLLBACK PASSED")

# Revoke financial permission and ensure the same authenticated user cannot edit.
c=connect()
with c.cursor() as q:
    q.execute("UPDATE public.user_company_access SET role='vendedor' WHERE user_id=%s",(USER,))
c.commit()
denied_snapshot=snapshot(c)
with c.cursor() as q:
    as_user(q)
    try:
        q.execute(SQL,(COMPANY,SELECTED,"all",110,"2026-01-31",Json(denied_snapshot)))
        raise AssertionError("sales-only role unexpectedly edited payables")
    except psycopg2.Error as e:
        assert e.pgcode=="42501",str(e)
        c.rollback()
c.close()
print("CP04 FINANCIAL ROLE DENIAL PASSED")
