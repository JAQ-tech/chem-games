-- مَنْهَل — seed.
-- Bootstrap file numbers let the first superadmin sign in. Replace them from
-- the staff screen or by importing staff-template.csv before real use.
--   900001 يعقوب المعمري        superadmin
--   900002 أحمد السناني         admin
--   900003 محمد النخيلي         admin
--   900004 محمود هلال المعمري   specialist
--   900005 د.سالم المعمري       principal

insert into periods (n, label_ar, label_en, starts, ends) values
  (1, 'الحصة الأولى',   'Period 1', '07:10', '07:45'),
  (2, 'الحصة الثانية',  'Period 2', '07:50', '08:25'),
  (3, 'الحصة الثالثة',  'Period 3', '08:30', '09:05'),
  (4, 'الحصة الرابعة',  'Period 4', '09:10', '09:45'),
  (5, 'الحصة الخامسة',  'Period 5', '10:05', '10:40'),
  (6, 'الحصة السادسة',  'Period 6', '10:45', '11:20'),
  (7, 'الحصة السابعة',  'Period 7', '11:25', '12:00');

insert into subject_holds (weekday, period, subject) values
  (0, 4, 'لغة عربية'),
  (1, 4, 'علوم'),
  (2, 4, 'رياضيات'),
  (2, 5, 'تربية إسلامية'),
  (3, 5, 'لغة إنجليزية'),
  (4, 4, 'الدراسات الاجتماعية');

insert into class_sections (label) values
  ('7-1'), ('7-2'), ('7-3'), ('7-4'), ('7-5'), ('7-6'), ('7-7'), ('7-8'), ('7-9'),
  ('8-1'), ('8-2'), ('8-3'), ('8-4'), ('8-5'), ('8-6'), ('8-7'), ('8-8'), ('8-9'), ('8-10'),
  ('9-1'), ('9-2'), ('9-3'), ('9-4'), ('9-5'), ('9-6'), ('9-7'), ('9-8'), ('9-9'),
  ('8س'), ('10س');

insert into staff (file_no, full_name, job_type, subject, role) values
  ('900001', 'يعقوب المعمري',        'technical', null, 'superadmin'),
  ('900002', 'أحمد السناني',         'admin',     null, 'admin'),
  ('900003', 'محمد النخيلي',         'admin',     null, 'admin'),
  ('900004', 'محمود هلال المعمري',   'technical', null, 'specialist'),
  ('900005', 'د.سالم المعمري',       'admin',     null, 'principal');

insert into settings (key, value) values
  ('app_name', to_jsonb('مَنْهَل'::text)),
  ('school_name', to_jsonb('مدرسة بلج بن عقبة الفراهيدي للبنين (٧-٩)'::text)),
  ('principal_name', to_jsonb('د.سالم المعمري'::text)),
  ('break', jsonb_build_object(
    'starts', '09:45',
    'ends', '10:05',
    'label_ar', 'الفسحة',
    'label_en', 'Break'
  ));
