insert into public.plans (name, description, monthly_price, yearly_price, currency, max_employees, max_sites, max_admins, history_days)
values
  ('FREE','Découverte',0,0,'XAF',5,1,1,7),
  ('STARTER','Petites équipes',5000,50000,'XAF',20,2,2,30),
  ('BUSINESS','Croissance',15000,150000,'XAF',100,10,5,90),
  ('ENTERPRISE','Sur mesure',0,0,'XAF',9999,9999,9999,365);

insert into public.features (key, name, description) values
  ('qr_checkin','Pointage QR','Pointage par QR code'),
  ('geolocation','Géolocalisation','Vérification position'),
  ('multi_sites','Multi-sites','Plusieurs sites'),
  ('reports_export','Exports','CSV/PDF'),
  ('realtime','Realtime','Temps réel'),
  ('notifications','Notifications','Alertes'),
  ('api_access','API','Accès API'),
  ('sso','SSO','Auth unique');

insert into public.platform_settings (key, value) values
  ('platform_name','"Pointify"'),
  ('default_currency','"XAF"'),
  ('trial_days','14');