INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial;
SET s3_region='us-west-2';
COPY (
  SELECT id, names."primary" AS name, brand.names."primary" AS brand,
    ST_X(geometry) AS lon, ST_Y(geometry) AS lat, confidence, operating_status,
    basic_category, taxonomy."primary" AS cat,
    addresses[1].freeform AS addr, addresses[1].locality AS city, addresses[1].region AS region,
    addresses[1].postcode AS postcode, addresses[1].country AS country,
    websites[1] AS website, phones[1] AS phone
  FROM read_parquet('s3://overturemaps-us-west-2/release/2026-10-21.0/theme=places/type=place/*.parquet')
  WHERE regexp_matches(lower(coalesce(names."primary",'') || ' ' || coalesce(brand.names."primary",'')),
    'hey ?tea|喜茶|molly ?tea|茉莉奶白|hero ?tea|英歌魂|coco|都可|chatime|日出茶太|gong ?cha|貢茶|贡茶|공차|kung ?fu ?tea|share ?tea|歇脚亭|chagee|霸王茶姬|tiger ?sugar|老虎堂|the alley|鹿角巷|yi ?fang|一芳|happy ?lemon|快乐柠檬|快樂檸檬|xing ?fu ?tang|幸福堂|machi ?machi|麥吉|bober ?tea|presotea|鮮茶道|tealive|tp ?tea|茶湯會|truedan|ding ?tea|naixue|奈雪|nayuki|mixue|蜜雪|boba ?guys')
) TO 'data/raw/overture.json' (FORMAT json, ARRAY true);
