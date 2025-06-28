-- Create proper demo user with correct password hash
UPDATE users 
SET password_hash = '$2a$12$8K9xQ0FZRnk9zWZQjxlWGOoXHYdP8G8YO4P3K7VfpQrjM9sHbN/6y',
    password_salt = ''
WHERE email = 'demo@rootuip.com';

-- This hash is for 'Demo123!' without salt