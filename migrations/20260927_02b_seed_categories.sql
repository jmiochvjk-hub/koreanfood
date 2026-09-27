-- Idempotent four-channel category seed.
-- Run after 20260927_02_catalog_foundation.sql.

insert into public.categories (
  channel,
  slug,
  name_zh,
  name_ko,
  name_en,
  sort_order
)
values
  ('food', 'korean-food', '韩餐', '한식', 'Korean food', 10),
  ('food', 'bbq', '烤肉', '고기구이', 'Korean BBQ', 20),
  ('food', 'street-food', '街头小吃', '길거리 음식', 'Street food', 30),
  ('food', 'cafe-dessert', '咖啡甜品', '카페·디저트', 'Cafe & dessert', 40),
  ('food', 'seafood', '海鲜', '해산물', 'Seafood', 50),
  ('food', 'drinks', '饮料', '음료', 'Drinks', 60),
  ('food', 'snacks', '零食', '과자', 'Snacks', 70),
  ('food', 'convenience-food', '便利店食品', '편의점 식품', 'Convenience food', 80),

  ('beauty', 'olive-young', 'Olive Young', '올리브영', 'Olive Young', 10),
  ('beauty', 'skincare', '护肤', '스킨케어', 'Skincare', 20),
  ('beauty', 'makeup', '彩妆', '메이크업', 'Makeup', 30),
  ('beauty', 'suncare', '防晒', '선케어', 'Suncare', 40),
  ('beauty', 'haircare', '发护', '헤어케어', 'Haircare', 50),
  ('beauty', 'bodycare', '身体护理', '바디케어', 'Body care', 60),
  ('beauty', 'fragrance', '香氛', '향수', 'Fragrance', 70),

  ('life', 'daiso', 'Daiso', '다이소', 'Daiso', 10),
  ('life', 'convenience', '便利店生活', '편의점 생활', 'Convenience', 20),
  ('life', 'home', '家居', '홈·리빙', 'Home', 30),
  ('life', 'storage', '收纳', '수납', 'Storage', 40),
  ('life', 'stationery', '文具', '문구', 'Stationery', 50),
  ('life', 'travel', '旅行用品', '여행용품', 'Travel essentials', 60),

  ('fashion', 'korean-brands', '韩国品牌', '한국 브랜드', 'Korean brands', 10),
  ('fashion', 'basics', '基础款', '베이직', 'Basics', 20),
  ('fashion', 'shoes', '鞋履', '신발', 'Shoes', 30),
  ('fashion', 'bags', '包袋', '가방', 'Bags', 40),
  ('fashion', 'accessories', '配饰', '액세서리', 'Accessories', 50),
  ('fashion', 'streetwear', '街头潮流', '스트리트웨어', 'Streetwear', 60)
on conflict (channel, slug) do update
set
  name_zh = excluded.name_zh,
  name_ko = excluded.name_ko,
  name_en = excluded.name_en,
  sort_order = excluded.sort_order,
  active = true;
