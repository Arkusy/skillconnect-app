-- Create table for legal documents
create table if not exists app_legal_docs (
  id uuid default uuid_generate_v4() primary key,
  doc_type text not null unique, -- 'privacy' or 'terms'
  title text not null,
  content text not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table app_legal_docs enable row level security;

-- Allow read access to everyone
create policy "Allow public read access"
  on app_legal_docs for select
  using (true);

-- Insert initial content (Privacy Policy) using multi-line strings
insert into app_legal_docs (doc_type, title, content)
values (
  'privacy',
  'Privacy Policy',
  'Last updated: January 25, 2026

1. Introduction
Welcome to our application. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our app and tell you about your privacy rights and how the law protects you.

2. Data We Collect
We may collect, use, store and transfer different kinds of personal data about you which we have grouped together follows: Identity Data, Contact Data, and Usage Data.

3. How We Use Your Data
We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances: Where we need to perform the contract we are about to enter into or have entered into with you.

4. Data Retention
We will only retain your personal data for as long as necessary to fulfil the purposes we collected it for, including for the purposes of satisfying any legal, accounting, or reporting requirements.

5. Account Deletion
If you choose to delete your account, your data will be retained for a 30-day grace period before permanent deletion, unless otherwise required by law. During this period, your account will be disabled.'
)
on conflict (doc_type) do update
set content = excluded.content, updated_at = now();

-- Insert initial content (Terms of Service) using multi-line strings
insert into app_legal_docs (doc_type, title, content)
values (
  'terms',
  'Terms of Service',
  'Last updated: January 25, 2026

1. Agreement to Terms
By accessing our application, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this site.

2. Use License
Permission is granted to temporarily download one copy of the materials (information or software) on our application for personal, non-commercial transitory viewing only.

3. Disclaimer
The materials on our application are provided on an "as is" basis. We make no warranties, expressed or implied, and hereby disclaim and negate all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.

4. Limitations
In no event shall we be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on our application.

5. Governing Law
These terms and conditions are governed by and construed in accordance with the laws of the state and you irrevocably submit to the exclusive jurisdiction of the courts in that state.'
)
on conflict (doc_type) do update
set content = excluded.content, updated_at = now();
