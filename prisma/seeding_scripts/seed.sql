TRUNCATE TABLE "OrderService" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "Order" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "Customer" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "Product" RESTART IDENTITY CASCADE;

INSERT INTO "Product"(
    "productName",
    "productDescription",
    "productCategory",
    "productPrice",
    "productImage",
    "productStock"
)
VALUES
    ('Bag of Marbles', 'Bold and shiny, perfect for all your taskmaster needs', 'Toys', 9.99, 'bagOfMarbles.webp', 2),
    ('Pool Set', 'Complete pool set for hours of fun', 'Toys', 49.99, 'poolSet.webp', 10),
    ('Hula Hoop', 'Classic toy for outdoor fun', 'Toys', 14.99, 'hulaHoop.webp', 25),
    ('Furby', 'Interactive electronic toy', 'Toys', 99.99, 'furby.webp', 10),
    ('Lego Set A', 'Creative building blocks for endless fun', 'Lego', 59.99, 'legoSet1.webp', 1),
    ('Lego Set B', 'Creative building blocks set', 'Lego', 79.99, 'legoSet2.webp', 7),
    ('Lego Set C', 'Creative building blocks set', 'Lego', 89.99, 'legoSet3.webp', 25),
    ('Lego Set D', 'Creative building blocks set', 'Lego', 99.99, 'legoSet4.webp', 0),
    ('Monopoly', 'Classic board game for family fun', 'Board Games', 29.99, 'monopoly.webp', 15),
    ('Cluedo', 'Classic detective board game', 'Board Games', 24.99, 'cluedo.webp', 15),
    ('Game of Life', 'Classic board game for family fun', 'Board Games', 34.99, 'gameOfLife.webp', 15),
    ('Catan', 'Popular strategy board game', 'Board Games', 39.99, 'catan.webp', 15),
    ('Barbie A', 'Classic Barbie doll', 'Dolls', 19.99, 'barbieA.webp', 15),
    ('Barbie B', 'Classic Barbie doll', 'Dolls', 19.99, 'barbieB.webp', 15),
    ('Monster High A', 'Classic Monster High doll', 'Dolls', 19.99, 'monsterHighA.webp', 0),
    ('Monster High B', 'Classic Monster High doll', 'Dolls', 19.99, 'monsterHighB.webp', 15);

INSERT INTO "Customer"(
    "customerForename",
    "customerSurname",
    "address",
    "postcode",
    "customerEmail",
    "customerPhone",
    "customerPassword"
)
VALUES
    ('John', 'Doe', '123 Town Street', 'BT16 AAA', 'johndoe@example.com', '0123456789', '$argon2id$v=19$m=19456,t=2,p=1$9m2tL3aA3YFY40bcUL+F5A$WwFh9L2R5fVcqBhP5bz/20GCSj4buvJhWR1uyeSuWP0'),
    ('Jane', 'Doe', '321 Up Street', 'BT16 AAA', 'janedoe@example.com', '0987654321', '$argon2id$v=19$m=19456,t=2,p=1$hR/cmqIM9eD/I5qOx0HNOA$cQVPjoq+5UNQgnPyWbxSBBenzTDSfdSVwfpYOFS63cA'),
    ('Alice', 'Smith', '456 Down Street', 'BT16 BBB', 'alicesmith@example.com', '0112233445', '$argon2id$v=19$m=19456,t=2,p=1$ymunqbuaaQNwQdoplFjX1w$c0vBdUnp96Ewf+jPRHb9Pf5Fj4XIZlMtH9GGSQ0eerw'),
    ('Bob', 'Johnson', '789 Left Street', 'BT16 CCC', 'bobjohnson@example.com', '0223344556', '$argon2id$v=19$m=19456,t=2,p=1$h/4V3vXvm0ribX0Au9zjiw$r5JPK/5fQSAmxAwkAbKODohX8RYEtAV8NPIeZmDZOtI'),
    ('Greg', 'Heffley', '88 Burger Town', 'BT12 ABC', 'gregheffley@example.com', '0334455667', '$argon2id$v=19$m=19456,t=2,p=1$w1mKkfMCvhaJAn4JJO524w$QXcWumehXC1V5If+MnOFeVXgvRU/nnOGUTmqR35EKwo'),
    ('Eva', 'Rouffet', '99 Peanuts Street', 'BT16 DDD', 'eva@example.com', '0445566778', '$argon2id$v=19$m=19456,t=2,p=1$cBWIwKee85ipl5fHE3m3hg$wXljgOWvNIWa5eNVocZ1Z2Fy/r8ExJ0rxW7DVcPQCNg');



INSERT INTO "Order"(
    "orderID",
    "customerID",
    "dateCreated",
    "status",
    "address",
    "postcode"
)
VALUES
    (1, 1, DEFAULT, 'completed', '123 Town Street', 'BT16 AAA'),
    (2, 6, DEFAULT, 'completed', '99 Peanuts Street', 'BT16 DDD'),
    (3, 6, DEFAULT, 'completed', '14 Gift Lane', 'BT9 5AB'),
    (4, 4, DEFAULT, 'completed', '789 Left Street', 'BT16 CCC'),
    (5, 5, DEFAULT, 'completed', '88 Burger Town', 'BT12 ABC'),
    (6, 2, '2026-10-10 09:45:33', 'completed', '321 Up Street', 'BT16 AAA'),
    (7, 6, '2026-10-14 18:12:47', 'paid', '99 Peanuts Street', 'BT16 DDD'),
    (8, 1, '2026-10-19 11:30:05', 'completed', '7 Office Park', 'BT3 9DT'),
    (9, 6, '2026-10-22 16:58:22', 'paid', '99 Peanuts Street', 'BT16 DDD'),
    (10, 6, '2026-10-25 13:17:49', 'completed', '14 Gift Lane', 'BT9 5AB'),
    (11, 3, '2026-10-28 10:05:31', 'paid', '456 Down Street', 'BT16 BBB'),
    (12, 1, '2026-11-01 15:41:08', 'completed', '123 Town Street', 'BT16 AAA'),
    (13, 4, '2026-11-03 08:29:54', 'paid', '789 Left Street', 'BT16 CCC'),
    (14, 2, '2026-11-04 19:14:27', 'completed', '321 Up Street', 'BT16 AAA');

-- Explicit IDs bypass the sequence, so move it on to avoid clashes with orders created by the API.
SELECT setval(pg_get_serial_sequence('"Order"', 'orderID'), (SELECT MAX("orderID") FROM "Order"));


INSERT INTO "OrderService" (
    "orderID",
    "productID",
    "quantity"
)
VALUES
    (1, 1, 2),
    (1, 2, 1),
    (2, 4, 1),
    (3, 3, 3);
SELECT order_line."orderID", order_line."productID", order_line.quantity
FROM (VALUES
    (1, 1, 2),
    (1, 2, 1),
    (1, 3, 1),
    (1, 4, 1),
    (2, 1, 1),
    (6, 5, 1),
    (6, 6, 1),
    (7, 4, 1),
    (7, 3, 2),
    (7, 1, 3),
    (8, 8, 1),
    (8, 12, 1),
    (8, 10, 2),
    (9, 13, 2),
    (9, 14, 1),
    (9, 15, 1),
    (10, 2, 1),
    (10, 10, 1),
    (10, 11, 1),
    (11, 6, 2),
    (11, 7, 1),
    (11, 8, 1),
    (12, 15, 1),
    (12, 16, 1),
    (12, 13, 2),
    (13, 11, 2),
    (13, 9, 1),
    (13, 12, 1),
    (14, 7, 1),
    (14, 14, 2),
    (14, 4, 1)
) AS order_line("orderID", "productID", quantity);
