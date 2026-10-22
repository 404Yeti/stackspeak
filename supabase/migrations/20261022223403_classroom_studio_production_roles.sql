-- Production identities inherit only the already-reviewed capability roles.
-- Credentials/LOGIN are assigned separately through the private release process.
-- Existing Preview passwords, object grants, policies and FORCE RLS are untouched.
create role classroom_reader_production nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
create role classroom_writer_production nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
grant classroom_reader to classroom_reader_production with inherit true;
grant classroom_reader to classroom_reader_production with set false;
grant classroom_reader to classroom_reader_production with admin false;
grant classroom_writer to classroom_writer_production with inherit true;
grant classroom_writer to classroom_writer_production with set false;
grant classroom_writer to classroom_writer_production with admin false;
