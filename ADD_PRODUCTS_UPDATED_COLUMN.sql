-- Añadir columna products_updated a product_sync_history si no existe
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_sync_history' 
    AND column_name = 'products_updated'
  ) THEN
    ALTER TABLE product_sync_history 
    ADD COLUMN products_updated INTEGER DEFAULT 0;
  END IF;
END $$;
