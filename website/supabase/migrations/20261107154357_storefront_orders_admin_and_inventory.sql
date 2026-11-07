-- Storefront schema extension. No private setup token or session secret is stored in this file.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stock_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

ALTER TABLE public.products
  ALTER COLUMN stock TYPE numeric(12,2) USING stock::numeric(12,2);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS amount_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_note text NOT NULL DEFAULT '';

ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'new';

CREATE TABLE IF NOT EXISTS public.store_admin_credentials (
  id integer PRIMARY KEY CHECK (id = 1),
  password_hash text,
  password_salt text,
  setup_token_hash text,
  session_secret text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.store_admin_credentials ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.store_rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0
);
ALTER TABLE public.store_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_store_products_active_sort ON public.products(active,sort_order);

INSERT INTO public.products(id,name,description,category,price_toman,stock,image_url,active,unit,price_confirmed,stock_confirmed,sort_order,updated_at)
VALUES
('kashk','کشک','کشک محلی؛ قیمت و موجودی پس از تأیید ثبت می‌شود.','لبنیات',0,0,'https://images.pexels.com/photos/10809146/pexels-photo-10809146.jpeg?cs=srgb&dl=pexels-eliftekkaya-10809146.jpg&fm=jpg',true,'کیلوگرم',false,false,10,now()),
('walnut-kernel','مغز گردو','مغز گردوی تولیدکنندگان پادنا.','خشکبار',0,0,'https://images.pexels.com/photos/36418624/pexels-photo-36418624.jpeg?cs=srgb&dl=pexels-edita-brus-2027796741-36418624.jpg&fm=jpg',true,'کیلوگرم',false,false,20,now()),
('grape-molasses','شیره انگور','شیره انگور؛ تصویر فعلی نمایشی از انگور است.','شیره‌ها',0,0,'https://images.pexels.com/photos/21193087/pexels-photo-21193087.jpeg?cs=srgb&dl=pexels-andres-alaniz-461433202-21193087.jpg&fm=jpg',true,'کیلوگرم',false,false,30,now()),
('apple-molasses','شیره سیب','شیره سیب؛ تصویر فعلی نمایشی از سیب است.','شیره‌ها',0,0,'https://images.pexels.com/photos/14833258/pexels-photo-14833258.jpeg?cs=srgb&dl=pexels-nogman-14833258.jpg&fm=jpg',true,'کیلوگرم',false,false,40,now()),
('vinegar','سرکه','سرکه محلی؛ حجم بطری هنگام تأیید سفارش مشخص می‌شود.','چاشنی‌ها',0,0,'https://images.pexels.com/photos/7493940/pexels-photo-7493940.jpeg?cs=srgb&dl=pexels-roman-odintsov-7493940.jpg&fm=jpg',true,'بطری ۱٫۵ لیتری',false,false,50,now()),
('honey','عسل','عسل عرضه‌شده از تولیدکنندگان منطقه.','عسل و فرآورده‌ها',0,0,'https://images.pexels.com/photos/5634203/pexels-photo-5634203.jpeg?cs=srgb&dl=pexels-adonyi-foto-5634203.jpg&fm=jpg',true,'کیلوگرم',false,false,60,now()),
('beans','لوبیا','لوبیای تولید منطقه پادنا.','حبوبات',0,0,'https://images.pexels.com/photos/5228850/pexels-photo-5228850.jpeg?cs=srgb&dl=pexels-leeloothefirst-5228850.jpg&fm=jpg',true,'کیلوگرم',false,false,70,now()),
('loar-cheese','پنیر لوار','پنیر لوار محلی؛ حداقل سفارش نیم‌کیلوگرم.','لبنیات',0,0,'https://images.pexels.com/photos/19460144/pexels-photo-19460144.jpeg?cs=srgb&dl=pexels-jaralol-19460144.jpg&fm=jpg',true,'کیلوگرم',false,false,80,now()),
('tahini','ارده','ارده کنجد؛ تصویر فعلی نمایشی از کنجد است.','چاشنی‌ها',0,0,'https://images.pexels.com/photos/8951047/pexels-photo-8951047.jpeg?cs=srgb&dl=pexels-ivan-s-8951047.jpg&fm=jpg',true,'کیلوگرم',false,false,90,now()),
('abghooreh','آبغوره','آبغوره تهیه‌شده از غوره سبز.','چاشنی‌ها',0,0,'https://images.pexels.com/photos/7656754/pexels-photo-7656754.jpeg?cs=srgb&dl=pexels-cup-of-couple-7656754.jpg&fm=jpg',true,'بطری',false,false,100,now()),
('date-molasses','شیره خرما','شیره خرما؛ تصویر فعلی نمایشی از خرماست.','شیره‌ها',0,0,'https://images.pexels.com/photos/20520971/pexels-photo-20520971.jpeg?cs=srgb&dl=pexels-visualstoriesbytugba-20520971.jpg&fm=jpg',true,'کیلوگرم',false,false,110,now()),
('fig','انجیر','انجیر خشک منطقه.','خشکبار',0,0,'https://images.pexels.com/photos/4499221/pexels-photo-4499221.jpeg?cs=srgb&dl=pexels-shkrabaanthony-4499221.jpg&fm=jpg',true,'کیلوگرم',false,false,120,now()),
('mulberry','توت خشک','توت خشک محلی.','خشکبار',0,0,'https://images.pexels.com/photos/4499220/pexels-photo-4499220.jpeg?cs=srgb&dl=pexels-shkrabaanthony-4499220.jpg&fm=jpg',true,'کیلوگرم',false,false,130,now())
ON CONFLICT (id) DO NOTHING;

UPDATE public.products SET image_url='https://images.pexels.com/photos/10809146/pexels-photo-10809146.jpeg?cs=srgb&dl=pexels-eliftekkaya-10809146.jpg&fm=jpg',description='کشک محلی؛ تصویر فعلی نمایشی از فرآورده لبنی مشابه است.',sort_order=10 WHERE id='kashk';
UPDATE public.products SET image_url='https://images.pexels.com/photos/36418624/pexels-photo-36418624.jpeg?cs=srgb&dl=pexels-edita-brus-2027796741-36418624.jpg&fm=jpg',description='مغز گردوی تولیدکنندگان پادنا؛ تصویر فعلی نمایشی است.',sort_order=20 WHERE id='walnut-kernel';
UPDATE public.products SET image_url='https://images.pexels.com/photos/21193087/pexels-photo-21193087.jpeg?cs=srgb&dl=pexels-andres-alaniz-461433202-21193087.jpg&fm=jpg',description='شیره انگور؛ تصویر فعلی نمایشی از انگور است.',sort_order=30 WHERE id='grape-molasses';
UPDATE public.products SET image_url='https://images.pexels.com/photos/14833258/pexels-photo-14833258.jpeg?cs=srgb&dl=pexels-nogman-14833258.jpg&fm=jpg',description='شیره سیب؛ تصویر فعلی نمایشی از سیب است.',sort_order=40 WHERE id='apple-molasses';
UPDATE public.products SET image_url='https://images.pexels.com/photos/7493940/pexels-photo-7493940.jpeg?cs=srgb&dl=pexels-roman-odintsov-7493940.jpg&fm=jpg',description='سرکه محلی؛ حجم بطری هنگام تأیید سفارش مشخص می‌شود.',sort_order=50 WHERE id='vinegar';
UPDATE public.products SET image_url='https://images.pexels.com/photos/5634203/pexels-photo-5634203.jpeg?cs=srgb&dl=pexels-adonyi-foto-5634203.jpg&fm=jpg',description='عسل عرضه‌شده از تولیدکنندگان منطقه؛ تصویر فعلی نمایشی است.',category='عسل و فرآورده‌ها',sort_order=60 WHERE id='honey';
UPDATE public.products SET image_url='https://images.pexels.com/photos/5228850/pexels-photo-5228850.jpeg?cs=srgb&dl=pexels-leeloothefirst-5228850.jpg&fm=jpg',description='لوبیای تولید منطقه پادنا؛ تصویر فعلی نمایشی است.',sort_order=70 WHERE id='beans';
UPDATE public.products SET image_url='https://images.pexels.com/photos/19460144/pexels-photo-19460144.jpeg?cs=srgb&dl=pexels-jaralol-19460144.jpg&fm=jpg',description='پنیر لوار محلی؛ حداقل سفارش نیم‌کیلوگرم. تصویر فعلی نمایشی از پنیر مشابه است.',sort_order=80 WHERE id='loar-cheese';
UPDATE public.products SET image_url='https://images.pexels.com/photos/8951047/pexels-photo-8951047.jpeg?cs=srgb&dl=pexels-ivan-s-8951047.jpg&fm=jpg',description='ارده کنجد؛ تصویر فعلی نمایشی از کنجد است.',sort_order=90 WHERE id='tahini';

CREATE OR REPLACE FUNCTION public.consume_store_rate_limit(p_key text,p_limit integer,p_window_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_hits integer;
BEGIN
  INSERT INTO public.store_rate_limits(key,window_start,hits) VALUES(p_key,now(),1)
  ON CONFLICT(key) DO UPDATE SET
    window_start=CASE WHEN public.store_rate_limits.window_start <= now()-make_interval(secs=>p_window_seconds) THEN now() ELSE public.store_rate_limits.window_start END,
    hits=CASE WHEN public.store_rate_limits.window_start <= now()-make_interval(secs=>p_window_seconds) THEN 1 ELSE public.store_rate_limits.hits+1 END
  RETURNING hits INTO v_hits;
  RETURN v_hits<=p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_store_order(p_order_id text,p_shipping_toman bigint,p_admin_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order public.orders%ROWTYPE; v_item jsonb; v_product public.products%ROWTYPE;
  v_qty numeric(12,2); v_subtotal bigint:=0; v_priced_items jsonb:='[]'::jsonb;
BEGIN
  IF p_shipping_toman IS NULL OR p_shipping_toman<0 THEN RAISE EXCEPTION 'INVALID_SHIPPING'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF v_order.status NOT IN ('new','reviewed') THEN RAISE EXCEPTION 'ORDER_STATUS_INVALID'; END IF;
  FOR v_item IN SELECT elem FROM jsonb_array_elements(COALESCE(v_order.items_json,v_order.items)) AS t(elem) LOOP
    v_qty:=(v_item->>'quantity')::numeric(12,2);
    IF v_qty IS NULL OR v_qty<=0 OR v_qty>100 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
    IF (v_item->>'productId')='loar-cheese' AND v_qty<0.5 THEN RAISE EXCEPTION 'MINIMUM_LOAR_CHEESE'; END IF;
    SELECT * INTO v_product FROM public.products WHERE id=(v_item->>'productId') FOR UPDATE;
    IF NOT FOUND OR NOT v_product.active OR NOT v_product.price_confirmed OR NOT v_product.stock_confirmed OR v_product.stock<v_qty THEN
      RAISE EXCEPTION 'PRODUCT_UNAVAILABLE:%',v_item->>'productId';
    END IF;
    v_subtotal:=v_subtotal+round(v_product.price_toman*v_qty)::bigint;
    v_priced_items:=v_priced_items||jsonb_build_array(v_item||jsonb_build_object('name',v_product.name,'unit',v_product.unit,'unitPriceToman',v_product.price_toman));
    UPDATE public.products SET stock=stock-v_qty,updated_at=now() WHERE id=v_product.id;
  END LOOP;
  IF jsonb_array_length(v_priced_items)=0 THEN RAISE EXCEPTION 'EMPTY_ORDER'; END IF;
  UPDATE public.orders SET items=v_priced_items,items_json=v_priced_items,subtotal_toman=v_subtotal,
    shipping_toman=p_shipping_toman,delivery_fee_toman=p_shipping_toman,total_toman=v_subtotal+p_shipping_toman,
    amount_confirmed=true,status='confirmed',admin_note=COALESCE(p_admin_note,admin_note),updated_at=now()
  WHERE id=p_order_id;
  INSERT INTO public.audit_log(actor,action,entity_type,entity_id,details,order_id,detail)
  VALUES('admin','order_confirmed','order',p_order_id,
    jsonb_build_object('subtotal_toman',v_subtotal,'shipping_toman',p_shipping_toman,'total_toman',v_subtotal+p_shipping_toman),
    p_order_id,'سفارش تأیید شد و موجودی رزرو شد.');
  RETURN jsonb_build_object('ok',true,'subtotalToman',v_subtotal,'shippingToman',p_shipping_toman,'totalToman',v_subtotal+p_shipping_toman);
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_store_order(p_order_id text,p_status text,p_admin_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order public.orders%ROWTYPE; v_item jsonb; v_qty numeric(12,2);
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF p_status='reviewed' AND v_order.status IN ('new','reviewed') THEN
    NULL;
  ELSIF p_status='preparing' AND v_order.status='confirmed' THEN
    NULL;
  ELSIF p_status='shipped' AND v_order.status='preparing' THEN
    NULL;
  ELSIF p_status='completed' AND v_order.status='shipped' THEN
    NULL;
  ELSIF p_status='cancelled' AND v_order.status IN ('new','reviewed','confirmed','preparing') THEN
    IF v_order.status IN ('confirmed','preparing') THEN
      FOR v_item IN SELECT elem FROM jsonb_array_elements(COALESCE(v_order.items_json,v_order.items)) AS t(elem) LOOP
        v_qty:=(v_item->>'quantity')::numeric(12,2);
        UPDATE public.products SET stock=stock+v_qty,updated_at=now() WHERE id=(v_item->>'productId');
      END LOOP;
    END IF;
  ELSE
    RAISE EXCEPTION 'ORDER_STATUS_INVALID';
  END IF;
  UPDATE public.orders SET status=p_status,admin_note=COALESCE(p_admin_note,admin_note),updated_at=now() WHERE id=p_order_id;
  INSERT INTO public.audit_log(actor,action,entity_type,entity_id,details,order_id,detail)
  VALUES('admin','status_changed','order',p_order_id,jsonb_build_object('from',v_order.status,'to',p_status),p_order_id,v_order.status||' -> '||p_status);
  RETURN jsonb_build_object('ok',true,'status',p_status);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_store_rate_limit(text,integer,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.confirm_store_order(text,bigint,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.transition_store_order(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_store_rate_limit(text,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_store_order(text,bigint,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_store_order(text,text,text) TO service_role;
