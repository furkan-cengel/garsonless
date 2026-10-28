# Rollback: 20261031100000_pano_business_summary

Adds one read-only function, `read_dashboard_pano_business`, used by the Pano business view.
Nothing is written. To remove it: `drop function public.read_dashboard_pano_business(uuid, timestamptz, text, integer);`
after the dashboard code that calls it is reverted.
