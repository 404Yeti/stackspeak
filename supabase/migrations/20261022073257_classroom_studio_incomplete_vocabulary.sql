-- Draft vocabulary may be incomplete. Public completion is validated when publishing.
alter table classroom.vocabulary drop constraint vocabulary_entry_check3;
alter table classroom.vocabulary add constraint vocabulary_term_length check (length(entry->>'term') <= 120);
