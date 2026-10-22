-- DESTRUCTIVE: disposable local databases only. Never a production rollback.
begin;
drop schema classroom cascade;
drop role classroom_reader;
drop role classroom_writer;
commit;
