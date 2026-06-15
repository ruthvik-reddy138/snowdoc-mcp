-- fact_orders.sql
-- Builds the central orders fact table from raw transactional data

WITH raw_orders AS (
    SELECT
        o.order_id,
        o.customer_id,
        o.order_date::DATE                          AS order_date,
        o.status,
        o.channel,
        o.created_at
    FROM RAW.ECOMMERCE.ORDERS o
    WHERE o.is_deleted = FALSE
      AND o.order_date >= '2020-01-01'
),

order_items AS (
    SELECT
        oi.order_id,
        SUM(oi.quantity * oi.unit_price)            AS gross_revenue,
        SUM(oi.discount_amount)                     AS total_discount,
        SUM(oi.quantity)                            AS total_units,
        COUNT(DISTINCT oi.product_id)               AS distinct_products
    FROM RAW.ECOMMERCE.ORDER_ITEMS oi
    INNER JOIN raw_orders ro ON oi.order_id = ro.order_id
    GROUP BY 1
),

customer_segment AS (
    SELECT
        c.customer_id,
        c.segment,
        c.region,
        c.lifetime_orders
    FROM CORE.DIM.DIM_CUSTOMERS c
    WHERE c.is_active = TRUE
)

SELECT
    ro.order_id                                     AS order_id,
    ro.customer_id                                  AS customer_id,
    cs.segment                                      AS customer_segment,
    cs.region                                       AS customer_region,
    ro.order_date                                   AS order_date,
    YEAR(ro.order_date)                             AS order_year,
    MONTH(ro.order_date)                            AS order_month,
    ro.status                                       AS order_status,
    ro.channel                                      AS sales_channel,
    oi.gross_revenue                                AS gross_revenue,
    oi.total_discount                               AS total_discount,
    oi.gross_revenue - oi.total_discount            AS net_revenue,
    oi.total_units                                  AS total_units_sold,
    oi.distinct_products                            AS distinct_products,
    CASE
        WHEN oi.gross_revenue >= 500 THEN 'High Value'
        WHEN oi.gross_revenue >= 100 THEN 'Mid Value'
        ELSE 'Low Value'
    END                                             AS order_value_tier,
    cs.lifetime_orders                              AS customer_lifetime_orders,
    CASE WHEN cs.lifetime_orders = 1 THEN TRUE ELSE FALSE END AS is_first_order,
    ro.created_at                                   AS created_at,
    CURRENT_TIMESTAMP()                             AS dbt_updated_at

FROM raw_orders ro
LEFT JOIN order_items oi ON ro.order_id = oi.order_id
LEFT JOIN customer_segment cs ON ro.customer_id = cs.customer_id
