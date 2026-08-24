-- Make the new reusable-template relation immediately visible to PostgREST.
notify pgrst, 'reload schema';
