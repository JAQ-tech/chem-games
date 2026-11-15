# مواصفات تطبيق «مَنْهَل» لحجز مركز مصادر التعلم

> وثيقة بناء موجّهة إلى Cursor AI. اتبعها حرفيًا. أي بند غير واضح يُسأل عنه، ولا يُفترض.

## 0. ملخص
- **اسم التطبيق (معتمد نهائيًا):** «مَنْهَل». يُعرَّف في ثابت واحد فقط `APP_NAME` داخل `js/config.js`، ويُقرأ منه في كل مكان (العنوان، manifest، PDF، APK).
- **الغرض:** حجز حصص التعلم الذاتي في مركز مصادر التعلم بمدرسة «مدرسة بلج بن عقبة الفراهيدي للبنين (٧-٩)»، سلطنة عُمان.
- **النموذج المرجعي:** تطبيق «جِسْر» لحجز مختبرات الحاسوب (PWA + Supabase + Netlify + APK من نوع WebView). نعيد استخدام الأسلوب نفسه، لكن **المشروع مستقل تمامًا**:
  - مستودع جديد.
  - مشروع Supabase جديد في منطقة **Frankfurt `eu-central-1`**. ممنوع استخدام أي منطقة في الهند.
  - موقع Netlify جديد، مقترح `balaj-lrc.netlify.app`.
  - حزمة Android جديدة `om.balaj.lrc`.
- **ممنوع** وضع أي مفتاح أو كلمة مرور في الكود أو في المستودع. المسموح في الواجهة فقط: `SUPABASE_URL` و`anon key`. مفتاح `service_role` لا يغادر لوحة Supabase.

## 1. المعايير الإلزامية
1. **التنسيق:** Tailwind CSS بأسلوب Wind UI، بمكوّنات نظيفة وزوايا مستديرة وظلال خفيفة. Tailwind مبني محليًا (ملف CSS ناتج)، وليس CDN في الإنتاج.
2. **اللغة والاتجاه:**
   - العربية افتراضيًا مع `dir="rtl"`.
   - زر تبديل إلى الإنجليزية (`ltr`).
   - كل النصوص في كائن ترجمة `T = { ar: {...}, en: {...} }`.
   - الاختيار محفوظ في `localStorage`.
3. **الشعارات الثلاثة:** الملفات موجودة بجانب هذا الملف في `assets/`. انسخها إلى `assets/` في المشروع، وتظهر في الترويسة وفي PDF:
   - `assets/school-logo.jpg`: شعار المدرسة.
   - `assets/oman-vision-2040.png`: رؤية عُمان 2040.
   - `assets/moe-logo.jpg`: وزارة التربية والتعليم.
4. **شريط علوي واضح في كل الصفحات:** «مدير المدرسة: د.سالم المعمري»، بخط عريض وخلفية مميزة، فوق الترويسة.
5. **ترويسة:** الشعارات الثلاثة، ثم اسم التطبيق «مَنْهَل»، ثم وصف «لحجز مركز مصادر التعلم»، ثم اسم المدرسة.
6. **سطر الحقوق** في تذييل كل صفحة:
   `برمجة وتصميم الاستاذ يعقوب المعمري – +96895537497`
7. **التطبيق:** PWA قابل للتثبيت (`manifest.json` و`sw.js` مع رقم إصدار للكاش)، ومتجاوب مع الجوال أولًا.

## 2. الأدوار والصلاحيات
| الدور | الأشخاص | الصلاحيات |
|---|---|---|
| `superadmin` | **يعقوب المعمري** (افتراضيًا) | كل شيء: إدارة الأدوار والمشرفين والإعدادات، وكل صلاحيات الأدوار الأخرى |
| `admin` | **أحمد السناني**، **محمد النخيلي** (مساعدا المدير) | إدارة الكادر والعطل والخانات المحجوبة، والتقارير وPDF، وعرض كل الحجوزات، وإلغاء أي حجز |
| `specialist` | **أ. محمود هلال المعمري**، أخصائي مصادر التعلم | قبول الطلبات أو رفضها مع سبب، وحجب الخانات، والتقارير وPDF |
| `principal` | **د.سالم المعمري** (مدير المدرسة) | عرض كل الحجوزات والطلبات، والتقارير، وتصدير PDF، والإشعارات. لا يقبل أو يرفض، ولا يدير الكادر أو الإعدادات. يستطيع الحجز لنفسه كأي موظف |
| `staff` | كل الكادر الإداري والفني والتدريسي | تقديم طلب حجز، وعرض الجدول، وإلغاء طلبه ما دام معلّقًا أو قبل موعد الحصة |
| زائر | — | لا شيء. يُوجَّه إلى صفحة الدخول |

يظهر اسم مدير المدرسة في الشريط العلوي دائمًا، وله أيضًا حساب بدور `principal`.

## 3. الدخول (معتمد)
- الدخول **برقم الملف فقط لكل المستخدمين**، بمن فيهم المشرفون. **لا يوجد PIN ولا كلمة مرور ولا رمز تحقق** لأي أحد.
- يُدخل المستخدم رقم ملفه، فيُطابَق في جدول `staff`، وتُنشأ جلسة Supabase مرتبطة بسجله (عبر Edge Function، والمعرّف الداخلي `file_no@lrc.local`).
- الجلسة محفوظة حتى الخروج.
- رقم ملف غير موجود أو حساب معطّل يُرفض برسالة واضحة.

## 4. الدوام والحصص
- أيام الدوام: الأحد إلى الخميس. الجمعة والسبت عطلة ولا تظهر في الجدول.
- عدد الحصص: **7 حصص يوميًا**، بالتوقيتات نفسها المعتمدة في «جِسْر». البيانات الأولية لجدول `periods`:

| الحصة | البداية | النهاية |
|---|---|---|
| الأولى | 07:10 | 07:45 |
| الثانية | 07:50 | 08:25 |
| الثالثة | 08:30 | 09:05 |
| الرابعة | 09:10 | 09:45 |
| **الفسحة** | **09:45** | **10:05** |
| الخامسة | 10:05 | 10:40 |
| السادسة | 10:45 | 11:20 |
| السابعة | 11:25 | 12:00 |

  الفسحة تُعرض صفًا أو فاصلًا في الجدول، ولا يمكن حجزها. يمكن تعديل الأوقات من الإعدادات.
- **الحجز أسبوعي:**
  - يعرض التطبيق الأسبوع الدراسي الحالي (الأحد إلى الخميس)، والحجز متاح ضمنه فقط، للحصص التي لم تبدأ بعد.
  - يمكن تصفّح الأسابيع السابقة للعرض والتقارير وPDF فقط.
  - يُفتح الأسبوع التالي تلقائيًا يوم الأحد.
- **الحصص المتتالية مسموحة:** يمكن في طلب واحد اختيار عدة حصص متتالية في اليوم نفسه، مثل الثالثة والرابعة. تُخزَّن كصف لكل حصة بنفس `group_id`، ويُقبل الطلب أو يُرفض كوحدة واحدة.
- **خانة واحدة = حجز واحد معتمد فقط** (يوم + حصة). يُسمح بعدة طلبات معلّقة على نفس الخانة، وعند قبول أحدها تُرفض البقية تلقائيًا مع إشعار لأصحابها.

## 5. نموذج البيانات (SQL)
```sql
create extension if not exists pgcrypto;

create type role_t as enum ('superadmin','admin','specialist','principal','staff');
create type booking_kind_t as enum ('lesson','event');
create type status_t as enum ('pending','approved','rejected','cancelled');

create table staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  file_no text unique not null,
  full_name text not null,
  job_type text not null check (job_type in ('teaching','admin','technical')),
  subject text,
  role role_t not null default 'staff',
  active boolean not null default true,
  created_at timestamptz default now()
);

create table periods (
  n smallint primary key check (n between 1 and 7),
  label_ar text not null,
  label_en text not null,
  starts time,
  ends time
);

create table class_sections (
  id smallserial primary key,
  label text unique not null
);

create table holidays (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  period smallint references periods(n),   -- null = اليوم كاملًا
  reason text,
  created_by uuid references staff(id),
  created_at timestamptz default now()
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  day date not null check (extract(isodow from day) in (7,1,2,3,4)), -- أحد..خميس
  period smallint not null references periods(n),
  group_id uuid not null default gen_random_uuid(), -- يجمع الحصص المتتالية في طلب واحد
  staff_id uuid not null references staff(id),
  kind booking_kind_t not null default 'lesson', -- حصة دراسية / فعالية
  class_section text,                    -- إلزامي للحصة فقط
  subject text,                          -- إلزامي للحصة فقط
  lesson_title text,                     -- إلزامي للحصة فقط
  event_title text,                      -- إلزامي للفعالية
  visitor_party text,                    -- الجهة الزائرة (اختياري)
  attendees int check (attendees is null or attendees > 0), -- إلزامي للفعالية
  equipment text,                        -- التجهيزات المطلوبة (اختياري)
  notes text,
  status status_t not null default 'pending',
  decided_by uuid references staff(id),
  decided_at timestamptz,
  reject_reason text,
  created_at timestamptz default now(),
  constraint kind_fields check (
    (kind = 'lesson' and class_section is not null and subject is not null and lesson_title is not null)
    or (kind = 'event' and event_title is not null and attendees is not null)
  )
);
-- حجز معتمد واحد فقط لكل خانة
create unique index one_approved_per_slot on bookings(day, period) where status = 'approved';

create table notifications (
  id bigserial primary key,
  staff_id uuid not null references staff(id),
  title text not null,
  body text not null,
  booking_id uuid references bookings(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz default now()
);

create table settings (
  key text primary key,
  value jsonb
);

create table audit_log (
  id bigserial primary key,
  actor uuid,
  action text,
  details jsonb,
  at timestamptz default now()
);

-- دوال مساعدة
create function me() returns staff language sql stable security definer as
$$ select * from staff where user_id = auth.uid() $$;

create function my_role() returns role_t language sql stable security definer as
$$ select role from staff where user_id = auth.uid() and active $$;

create function is_manager() returns boolean language sql stable security definer as
$$ select coalesce(my_role() in ('superadmin','admin','specialist'), false) $$;

create function can_view_reports() returns boolean language sql stable security definer as
$$ select coalesce(my_role() in ('superadmin','admin','specialist','principal'), false) $$;
```

### RLS
```sql
alter table staff enable row level security;
alter table bookings enable row level security;
alter table holidays enable row level security;
alter table notifications enable row level security;
alter table periods enable row level security;
alter table settings enable row level security;
alter table audit_log enable row level security;
alter table class_sections enable row level security;
create policy cs_read on class_sections for select using (true);
create policy cs_write on class_sections for all using (my_role() in ('superadmin','admin'));

-- staff
create policy staff_read on staff for select using (auth.uid() is not null);
create policy staff_write on staff for all
  using (my_role() in ('superadmin','admin'))
  with check (my_role() in ('superadmin','admin'));
-- منع admin من منح أو سحب دور superadmin يتم بـ trigger

-- bookings: الكل يقرأ (لعرض الجدول)، والموظف ينشئ لنفسه pending فقط
create policy b_read on bookings for select using (auth.uid() is not null);
create policy b_insert on bookings for insert
  with check (staff_id = (me()).id and status = 'pending');
create policy b_cancel_own on bookings for update
  using (staff_id = (me()).id and status in ('pending','approved') and day >= current_date)
  with check (status = 'cancelled');
create policy b_manage on bookings for update using (is_manager());

-- holidays و periods و settings: قراءة للجميع، والكتابة للمشرفين
create policy h_read on holidays for select using (auth.uid() is not null);
create policy h_write on holidays for all using (is_manager()) with check (is_manager());
create policy p_read on periods for select using (true);
create policy p_write on periods for all using (my_role() = 'superadmin');
create policy s_read on settings for select using (true);
create policy s_write on settings for all using (my_role() = 'superadmin');

-- notifications: كل موظف يرى إشعاراته فقط
create policy n_own on notifications for select using (staff_id = (me()).id);
create policy n_mark on notifications for update using (staff_id = (me()).id);

-- audit_log: القراءة للمشرف العام فقط
create policy a_read on audit_log for select using (my_role() = 'superadmin');
```

### Triggers وRPC
- **trigger قبل الإدراج في `bookings`:** يرفض إذا كانت الخانة في `holidays`، أو الحصة بدأت، أو اليوم جمعة أو سبت، أو التاريخ خارج الأسبوع الحالي، أو كانت حصص `group_id` الواحد غير متتالية أو في أيام مختلفة.
- **RPC `decide_booking(group_id, approve bool, reason text)`** (security definer، للمشرفين فقط):
  1. يحدّث حالة كل حصص المجموعة. يفشل القبول إذا كانت أي حصة منها معتمدة لغيره.
  2. عند القبول يرفض الطلبات المعلّقة الأخرى على نفس الخانة.
  3. يُنشئ إشعارًا لكل صاحب طلب.
  4. يكتب في `audit_log`.
- **trigger بعد إدراج حجز:** إشعار لكل من دوره `specialist` بوجود «طلب حجز جديد».
- **trigger بعد الإلغاء:** إشعار للأخصائي.
- **trigger على `staff`:** يمنع غير superadmin من تعديل الأدوار `superadmin` و`admin`.

### بيانات أولية
- `periods`: الحصص من 1 إلى 7، بأسماء «الحصة الأولى» إلى «السابعة».
- `staff`:
  - يعقوب المعمري (`superadmin`).
  - أحمد السناني ومحمد النخيلي (`admin`).
  - محمود هلال المعمري (`specialist`).
  - د.سالم المعمري (`principal`).
  - أرقام الملفات تُدخل من لوحة الإدارة أو باستيراد CSV.
- `class_sections`: القائمة نفسها في «جِسْر» بدون 12س، وبهذا الترتيب:
  `7-1, 7-2, 7-3, 7-4, 7-5, 7-6, 7-7, 7-8, 7-9, 8-1, 8-2, 8-3, 8-4, 8-5, 8-6, 8-7, 8-8, 8-9, 8-10, 9-1, 9-2, 9-3, 9-4, 9-5, 9-6, 9-7, 9-8, 9-9, 8س, 10س`
- `settings`: `app_name`، و`school_name`، و`principal_name`.

## 6. الشاشات
1. **الدخول:**
   - الشعارات الثلاثة وشريط المدير.
   - حقل رقم الملف فقط.
   - تبديل اللغة.
2. **الجدول الأسبوعي (الرئيسية)**، للأسبوع الحالي:
   - شبكة: الأعمدة الحصص 1 إلى 7، والصفوف الأحد إلى الخميس، كما في الورقة.
   - نطاق تاريخ الأسبوع ظاهر. التنقّل للأسابيع السابقة للعرض فقط.
   - ألوان الخانات:
     - فارغة: بيضاء، والنقر عليها يفتح نموذج الحجز.
     - معلّقة: صفراء.
     - معتمدة: خضراء، وتعرض الاسم والصف والمادة.
     - عطلة أو محجوبة: رمادية.
     - ماضية: معطّلة.
   - على الجوال يُعرض الجدول بطاقات يوم بيوم.
3. **نموذج الحجز:**
   - **نوع الحجز** (أزرار اختيار): «حصة دراسية» (افتراضي) أو «فعالية». يقدّمه موظف نيابةً عن الفعالية.
   - **إذا كان النوع فعالية**، تظهر هذه الحقول بدل حقول الحصة (الصف والشعبة، والمادة، وعنوان الدرس):
     - عنوان الفعالية (إلزامي).
     - الجهة الزائرة (اختياري).
     - عدد الحضور (إلزامي، رقم أكبر من صفر).
     - التجهيزات المطلوبة (اختياري، مثل جهاز عرض أو مكبر صوت أو كراسي إضافية).
     - الملاحظات والحصص المتتالية كما في الحصة.
   - **إذا كان النوع حصة دراسية**، تظهر الحقول التالية:
   - الاسم (مملوء تلقائيًا، غير قابل للتعديل).
   - الحصص: الحصة المنقورة، مع إمكانية إضافة الحصص المتتالية الفارغة بعدها أو قبلها في اليوم نفسه.
   - الصف والشعبة (إلزامي، قائمة منسدلة من `class_sections`).
   - المادة (إلزامي، تُقترح مادة الموظف).
   - عنوان الدرس (إلزامي).
   - ملاحظات (اختياري).
   - زر إرسال، ثم رسالة «أُرسل الطلب وبانتظار موافقة أخصائي المركز».
4. **حجوزاتي:** قائمة بحالة كل طلب (معلّق، معتمد، مرفوض مع السبب، ملغى)، وزر إلغاء.
5. **الطلبات** (القبول والرفض للأخصائي والمشرفين، والمدير يطّلع عليها فقط):
   - قائمة المعلّقة بالأقدم أولًا.
   - أزرار «قبول» و«رفض» مع سبب.
   - شارة بعدد المعلّق.
6. **الإشعارات:** جرس بعدد غير المقروء، وقائمة، و«تعليم الكل كمقروء».
7. **لوحة الإدارة:**
   - **الكادر:** إضافة وتعديل وتعطيل، وتعيين الأدوار (للمشرف العام).
     - **متطلب بيانات الكادر:** يستورد المشرف ملف CSV أو Excel (`.xlsx`، يُقرأ في المتصفح بمكتبة SheetJS) يحوي الأعمدة:
       - `full_name`: الاسم.
       - `file_no`: رقم الملف.
       - `job_type`: نوع الوظيفة، `إداري` أو `فني` أو `معلم`، وتحوَّل إلى `admin` و`technical` و`teaching`.
       - `subject`: المادة (اختياري).
     - قالب جاهز: `staff-template.csv`. الصفوف المعلَّمة بـ`example` في عمود `note` تُتجاهل.
     - قبل الحفظ تُعرض معاينة مع الأخطاء: رقم ملف مكرر، أو حقل ناقص، أو نوع وظيفة غير صحيح. أرقام الملفات الموجودة تُحدَّث ولا تُكرَّر.
     - **لا حاجة لجداول حصص المعلمين** في هذا التطبيق.
   - **العطل والخانات المحجوبة:** يوم كامل أو حصة محددة، مع سبب.
   - **التقارير** (متاحة أيضًا للمدير `principal`)، مع فصل الحصص عن الفعاليات وعدد حضور الفعاليات:
     - عدد الحصص المعتمدة لكل موظف ولكل مادة ولكل صف خلال فترة.
     - نسبة إشغال المركز.
     - تصدير CSV.
   - **تصدير PDF الأسبوعي.**
   - **الإعدادات** (للمشرف العام): أوقات الحصص، وأسماء المدرسة والمدير.

## 7. التدفقات
1. **الحجز:**
   1. الموظف ينقر خانة فارغة ويملأ النموذج، فيُنشأ طلب `pending`.
   2. يصل إشعار إلى الأخصائي.
   3. الأخصائي يقبل، فتصبح الحالة `approved`، وتُرفض المنافسة تلقائيًا، ويصل إشعار للموظف «تم قبول حجزك…».
   4. أو يرفض مع سبب، فيصل إشعار «رُفض حجزك: السبب».
2. **الإلغاء:** الموظف يلغي، فتتحرر الخانة ويصل إشعار للأخصائي.
3. **الحجب:** إضافة عطلة تحجب الخانة. إذا وُجدت حجوزات قائمة عليها يُعرض تحذير، وعند التأكيد تُلغى مع إشعار أصحابها.

## 8. الإشعارات (مثل «جِسْر»)
- **داخل التطبيق:** جدول `notifications` مع Supabase Realtime، وتحديث الجرس فورًا.
- **إشعار المتصفح:** Notification API عبر Service Worker عند منح الإذن.
- **APK:**
  - خدمة `JobScheduler` كل 15 دقيقة (الحد الأدنى في Android). **لا** تُستخدم خدمة foreground.
  - تستعلم REST عن الإشعارات غير المقروءة للمستخدم وتعرضها كإشعار نظام.
  - تمرير هوية الدخول للطرف الأصلي عبر جسر JavaScript، كما في «جِسْر».
- نصوص الإشعارات بالعربية والإنجليزية حسب لغة المستخدم.

## 9. تصدير PDF الأسبوعي (مطابق للورقة)
يصدّره: superadmin وadmin وspecialist وprincipal. **يعرض الحجوزات المعتمدة فقط.**
- **المكتبة:** جانب العميل، مثل `pdfmake` مع خط عربي مضمّن (Amiri أو Noto Naskh Arabic)، أو صفحة طباعة HTML مع `@page { size: A4 landscape }`. المهم أن يكون النص العربي سليم التشكيل والاتجاه.
- **الاتجاه:** أفقي A4.
- **الترويسة:** الشعارات الثلاثة، واسم المدرسة.
- **العنوان:**
  `جدول حصص التعلم الذاتي بمركز مصادر التعلم للأسبوع من ( / / ) إلى الخميس ( / / ٢٠٢٦ م)`
  تُملأ التواريخ تلقائيًا من الأسبوع المختار (الأحد والخميس) بأرقام عربية.
- **الجدول:**
  - الأعمدة: اليوم، ثم الحصة الأولى، الثانية، الثالثة، الرابعة، الخامسة، السادسة، السابعة.
  - الصفوف: الأحد، الاثنين، الثلاثاء، الأربعاء، الخميس.
  - خانة **الحصة** تحوي ثلاثة أسطر: `الاسم: …` و`الصف: …` و`المادة: …`. خانة **الفعالية** تحوي: `فعالية: <العنوان>` و`مقدّم الطلب: <الاسم>`، من الحجوزات **المعتمدة** فقط. الخانة الفارغة تبقى بالسطور نفسها فارغة لتعبئتها يدويًا.
  - العطلة تُكتب داخل الخانة.
- **تذييل:** «ملاحظات:» مع أسطر فارغة، ثم توقيع أخصائي مصادر التعلم: أ. محمود هلال المعمري، ثم سطر الحقوق.
- اسم الملف: `manhal-week-YYYY-MM-DD.pdf`.

## 10. هيكل المشروع
```
lrc-booking/
  index.html  manifest.json  sw.js  netlify.toml  tailwind.config.js
  css/ (input.css, app.css)
  js/ config.js  app.js (UI + T)  store.js (Supabase)  pdf.js  admin.js
  assets/ school-logo.jpg oman-vision-2040.png moe-logo.jpg icons/
  supabase/ schema.sql rls.sql seed.sql functions/
  android/  (مشروع WebView على غرار labs-apk)
```

## 11. تطبيق Android (APK)
- **النوع:** WebView أصلي يحمّل رابط Netlify المباشر، مثل «جِسْر».
- **الحزمة:** `om.balaj.lrc`، والإصدار `1.0.0` (versionCode 1).
- **الصلاحيات:** `INTERNET`، و`ACCESS_NETWORK_STATE`، و`RECEIVE_BOOT_COMPLETED`، و`POST_NOTIFICATIONS`.
- **المكوّنات:**
  - `LrcJob` (JobScheduler، كل 15 دقيقة) لاستطلاع الإشعارات.
  - مستقبِل الإقلاع لإعادة الجدولة.
  - دعم زر الرجوع، والتنزيل لملفات PDF.
- **التوقيع:** keystore جديد خاص بالمشروع، خارج المستودع. كلمة مروره لا تُكتب في أي ملف مُتتبَّع.

## 12. النشر
1. إنشاء مشروع Supabase جديد في منطقة `eu-central-1` (Frankfurt).
2. تشغيل `schema.sql` ثم `rls.sql` ثم `seed.sql`.
3. تفعيل Realtime على `notifications` و`bookings`.
4. وضع `SUPABASE_URL` و`anon key` في `js/config.js`. لا مفاتيح أخرى.
5. `npx tailwindcss -i css/input.css -o css/app.css --minify`.
6. إنشاء موقع Netlify جديد (`balaj-lrc`) ونشر المجلد بالسحب والإفلات أو عبر Git.
7. رفع رقم إصدار كاش `sw.js` مع كل نشر.
8. بناء APK موقّع وتوزيعه.

## 13. قائمة اختبارات القبول
- [ ] اسم «مَنْهَل» يُغيَّر من ثابت واحد، وينعكس على العنوان وmanifest وPDF.
- [ ] الشريط العلوي «د.سالم المعمري» ظاهر في كل الصفحات.
- [ ] الشعارات الثلاثة تظهر في الترويسة وPDF.
- [ ] سطر الحقوق ظاهر في التذييل.
- [ ] تبديل العربية والإنجليزية يقلب الاتجاه وكل النصوص.
- [ ] الدخول برقم ملف صحيح ينجح بلا PIN لأي دور، والخاطئ أو المعطّل يُرفض.
- [ ] د.سالم يدخل ويرى كل الحجوزات والتقارير وPDF، ولا يظهر له زر قبول أو رفض.
- [ ] الأوقات والفسحة مطابقة لـ«جِسْر»، والفسحة غير قابلة للحجز.
- [ ] قائمة الصفوف مطابقة لـ«جِسْر» بدون 12س.
- [ ] الحجز متاح للأسبوع الحالي فقط.
- [ ] طلب واحد لحصص متتالية يُقبل أو يُرفض كوحدة، وتُرفض الحصص غير المتتالية.
- [ ] الجدول يعرض الأحد إلى الخميس × 7 حصص فقط.
- [ ] لا يمكن الحجز في تاريخ ماضٍ، أو عطلة، أو خانة محجوبة. يُتحقق من ذلك في الخادم أيضًا.
- [ ] الطلب الجديد `pending` يصل إشعاره للأخصائي.
- [ ] القبول يرفض الطلبات المنافسة تلقائيًا، ويصل إشعار لكل الأطراف.
- [ ] استحالة وجود حجزين معتمدين لخانة واحدة (فهرس فريد).
- [ ] موظف عادي لا يستطيع قبول الطلبات، ولا تعديل حجوزات غيره، ولا قراءة إشعارات غيره (اختبار RLS بحسابين).
- [ ] admin لا يستطيع ترقية نفسه أو غيره إلى superadmin.
- [ ] PDF أفقي مطابق للورقة: العنوان والتواريخ صحيحة، والأعمدة الحصة الأولى إلى السابعة، والصفوف الأحد إلى الخميس، والخانة أسطر الاسم والصف والمادة، والتذييل ملاحظات. العربية سليمة.
- [ ] حجز «فعالية» يقبل الطلب بلا صف أو مادة، ويرفضه بلا عنوان أو عدد حضور (في الواجهة وفي قيد قاعدة البيانات).
- [ ] الفعالية تمر بموافقة الأخصائي نفسها، وتظهر في PDF بعنوانها ومقدّم الطلب.
- [ ] حجز «حصة» بلا صف أو مادة أو عنوان يُرفض.
- [ ] استيراد `staff-template.csv` و`.xlsx` يعمل، ويتجاهل صفوف example، ويُظهر أخطاء التكرار والنقص.
- [ ] التقارير و CSV صحيحة.
- [ ] PWA قابل للتثبيت ويعمل بعد التحديث (نسخة كاش جديدة).
- [ ] APK يثبت ويفتح الموقع ويُظهر إشعار نظام خلال 15 دقيقة من قبول الحجز.
- [ ] لا يوجد أي مفتاح سري أو `service_role` في المستودع (`grep`).
- [ ] مشروع Supabase في Frankfurt.

## 14. أسئلة مفتوحة
