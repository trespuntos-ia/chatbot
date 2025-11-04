-- Agregar política DELETE a la tabla products
-- Esto permite eliminar productos usando la clave anon

-- Política para permitir eliminación pública
CREATE POLICY "Allow public delete access" ON products
  FOR DELETE USING (true);

