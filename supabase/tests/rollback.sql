-- DESTRUCTIVE: disposable local databases only. Never a production rollback.
begin;
drop schema classroom cascade;
drop role if exists classroom_reader_production;
drop role if exists classroom_writer_production;
drop role classroom_reader;
drop role classroom_writer;
commit;
