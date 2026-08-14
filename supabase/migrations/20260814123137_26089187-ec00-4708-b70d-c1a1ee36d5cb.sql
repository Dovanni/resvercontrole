GRANT EXECUTE ON FUNCTION public.check_current_user_is_active_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_current_user_is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_current_user_is_active_member(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_current_user_is_admin(uuid) TO service_role;