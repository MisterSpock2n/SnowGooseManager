-- Lock down helper/trigger functions so they can't be called directly via the API
revoke execute on function public.is_maf_closer(uuid) from public, anon, authenticated;
revoke execute on function public.maintenance_actions_before_write() from public, anon, authenticated;
revoke execute on function public.maintenance_actions_log_events() from public, anon, authenticated;
revoke execute on function public.can_close_maf() from public, anon;
grant execute on function public.can_close_maf() to authenticated;
