-- Funções internas não ficam expostas na API
revoke execute on function public.ao_criar_usuario() from authenticated, anon, public;
revoke execute on function public.gerar_codigo(text) from authenticated, anon, public;
alter default privileges in schema public revoke execute on functions from anon;
