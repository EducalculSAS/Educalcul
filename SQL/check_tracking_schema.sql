-- Check for existing tracking tables and columns
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM 
    information_schema.columns 
WHERE 
    table_schema = 'public' 
    AND (
        table_name LIKE '%session%' 
        OR table_name LIKE '%progress%' 
        OR table_name LIKE '%attempt%' 
        OR table_name LIKE '%score%' 
        OR table_name LIKE '%log%'
        OR table_name LIKE '%track%'
        OR table_name = 'users'
    )
ORDER BY 
    table_name, ordinal_position;
