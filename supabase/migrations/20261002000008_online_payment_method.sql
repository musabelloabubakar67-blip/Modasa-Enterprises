-- "Online" payments (website orders paid through the payment provider). In its own migration
-- because a new enum value can't be used in the same transaction that adds it.
alter type public.payment_method add value if not exists 'online';
