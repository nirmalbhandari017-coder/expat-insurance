-- ============================================================================
-- seed_dev.sql  (DEVELOPMENT demo data only — do NOT run in production)
-- A handful of affiliates + leads across statuses/months so dashboards and
-- analytics render. Inserted directly at target status; milestone dates set
-- explicitly (the auto-stamp trigger only fires on UPDATE, not INSERT).
-- ============================================================================

insert into affiliates (name, contact_person, email, phone, commission_pct, type, country, is_active) values
 ('Bangkok Relocation Co.','Anong S.','anong@bkkrelo.example','+66 2 111 2222', 12.50,'relocation_agency','TH', true),
 ('ExpatEase Services',     'James P.','james@expatease.example','+66 76 333 444', 10.00,'expat_services','TH', true),
 ('Nomad Referrals',        'Lena K.','lena@nomadref.example','+49 30 555 666',  15.00,'referral_partner','DE', true),
 ('Siam Wealth Advisors',   'Krit T.','krit@siamwealth.example','+66 2 777 888',  8.00,'financial_advisor','TH', false)
on conflict do nothing;

-- Helper: insert leads referencing affiliates + insurance types by name.
with a as (select id, name from affiliates),
     t as (select id, name from insurance_types)
insert into leads (customer_name, email, phone, nationality, country_of_residence,
                   insurance_type_id, affiliate_id, current_status, source_channel,
                   quote_date, application_date, payment_date, policy_number,
                   lost_reason, lost_reason_detail, created_at, stage_entered_at)
select v.customer_name, v.email, v.phone, v.nationality, v.residence,
       (select id from t where t.name = v.itype),
       (select id from a where a.name = v.aff),
       v.status::lead_status, 'manual',
       v.quote_date, v.appl_date, v.pay_date, v.policy,
       v.lost_reason::lost_reason, v.lost_detail,
       v.created_at, v.created_at
from (values
 ('Oliver Grant','oliver.grant@example.com','+66 81 000 0001','GB','TH','Health','Bangkok Relocation Co.','inbound',           null,null,null,null,null,null, now()-interval'1 day'),
 ('Mia Fontaine','mia.f@example.com','+66 81 000 0002','FR','TH','Travel','Bangkok Relocation Co.','inbound',                  null,null,null,null,null,null, now()-interval'5 day'),
 ('Lucas Meyer','lucas.meyer@example.com','+49 170 000003','DE','TH','Health','Nomad Referrals','contacted',                   null,null,null,null,null,null, now()-interval'9 day'),
 ('Sofia Rossi','sofia.rossi@example.com','+39 320 000004','IT','TH','Life','ExpatEase Services','contacted',                  null,null,null,null,null,null, now()-interval'3 day'),
 ('Henrik Bauer','henrik.b@example.com','+49 171 000005','DE','TH','Health','Nomad Referrals','opportunity_open',              (now()-interval'8 day')::date,null,null,null,null,null, now()-interval'8 day'),
 ('Aisha Rahman','aisha.r@example.com','+60 12 0000006','MY','TH','Critical Illness','ExpatEase Services','opportunity_open',   (now()-interval'2 day')::date,null,null,null,null,null, now()-interval'2 day'),
 ('Daniel Kim','daniel.kim@example.com','+82 10 0000007','KR','TH','Health','Bangkok Relocation Co.','account_pending',        (now()-interval'20 day')::date,(now()-interval'6 day')::date,null,null,null,null, now()-interval'20 day'),
 ('Emma Novak','emma.novak@example.com','+61 4 00000008','AU','TH','Income Protection','ExpatEase Services','account_pending',  (now()-interval'25 day')::date,(now()-interval'18 day')::date,null,null,null,null, now()-interval'25 day'),
 ('Noah Williams','noah.w@example.com','+1 415 0000009','US','TH','Health','Bangkok Relocation Co.','account_open',            (now()-interval'55 day')::date,(now()-interval'48 day')::date,(now()-interval'40 day')::date,'POL-10001',null,null, now()-interval'60 day'),
 ('Chloe Martin','chloe.m@example.com','+33 6 00000010','FR','TH','Life','Nomad Referrals','account_open',                     (now()-interval'80 day')::date,(now()-interval'70 day')::date,(now()-interval'62 day')::date,'POL-10002',null,null, now()-interval'85 day'),
 ('Marco Bianchi','marco.b@example.com','+39 333 000011','IT','TH','Health','ExpatEase Services','account_open',               (now()-interval'110 day')::date,(now()-interval'100 day')::date,(now()-interval'92 day')::date,'POL-10003',null,null, now()-interval'120 day'),
 ('Yuki Tanaka','yuki.t@example.com','+81 90 0000012','JP','TH','Health','Bangkok Relocation Co.','account_lapsed',            (now()-interval'200 day')::date,(now()-interval'190 day')::date,(now()-interval'180 day')::date,'POL-10004',null,null, now()-interval'210 day'),
 ('Priya Nair','priya.n@example.com','+91 98 00000013','IN','TH','Critical Illness','Nomad Referrals','lost',                  null,null,null,null,'too_expensive',null, now()-interval'40 day'),
 ('Tom Becker','tom.becker@example.com','+49 172 000014','DE','TH','Travel','ExpatEase Services','lost',                       null,null,null,null,'unresponsive',null, now()-interval'30 day'),
 ('Grace Lee','grace.lee@example.com','+65 8 000 00015','SG','TH','Health','Bangkok Relocation Co.','lost',                    (now()-interval'50 day')::date,null,null,null,'bought_elsewhere',null, now()-interval'52 day'),
 ('Felix Braun','felix.b@example.com','+43 660 000016','AT','TH','Life','Siam Wealth Advisors','lost',                        null,null,null,null,'other','Moved back to home country', now()-interval'70 day')
) as v(customer_name,email,phone,nationality,residence,itype,aff,status,quote_date,appl_date,pay_date,policy,lost_reason,lost_detail,created_at);

refresh materialized view mv_affiliate_stats;
