insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 8388608, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

create policy "public read product images" on storage.objects for select using (bucket_id = 'product-images');
create policy "admin all product images" on storage.objects for all using (bucket_id = 'product-images' and public.is_admin()) with check (bucket_id = 'product-images' and public.is_admin());
create policy "vendor upload product images" on storage.objects for insert with check (
  bucket_id = 'product-images'
  and split_part(name, '/', 1) = public.current_vendor_id()::text
);
create policy "vendor delete own product images" on storage.objects for delete using (
  bucket_id = 'product-images'
  and split_part(name, '/', 1) = public.current_vendor_id()::text
);
