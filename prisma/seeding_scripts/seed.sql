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
    ('Bag of Marbles', 'Bold and shiny, perfect for all your taskmaster needs', 'Toys', 9.99, 'bagOfMarbles.webp', 25),
    ('Pool Set', 'Complete pool set for hours of fun', 'Toys', 49.99, 'poolSet.webp', 10),
    ('Hula Hoop', 'Classic toy for outdoor fun', 'Toys', 14.99, 'hulaHoop.webp', 25),
    ('Furby', 'Interactive electronic toy', 'Toys', 99.99, 'furby.webp', 10),
    ('Lego Set A', 'Creative building blocks for endless fun', 'Lego', 59.99, 'legoSet1.webp', 15),
    ('Lego Set B', 'Creative building blocks set', 'Lego', 79.99, 'legoSet2.webp', 20),
    ('Lego Set C', 'Creative building blocks set', 'Lego', 89.99, 'legoSet3.webp', 25),
    ('Lego Set D', 'Creative building blocks set', 'Lego', 99.99, 'legoSet4.webp', 30),
    ('Monopoly', 'Classic board game for family fun', 'Board Games', 29.99, 'monopoly.webp', 15),
    ('Cluedo', 'Classic detective board game', 'Board Games', 24.99, 'cluedo.webp', 15),
    ('Game of Life', 'Classic board game for family fun', 'Board Games', 34.99, 'gameOfLife.webp', 15),
    ('Catan', 'Popular strategy board game', 'Board Games', 39.99, 'catan.webp', 15),
    ('Barbie A', 'Classic Barbie doll', 'Dolls', 19.99, 'barbieA.webp', 15),
    ('Barbie B', 'Classic Barbie doll', 'Dolls', 19.99, 'barbieB.webp', 15),
    ('Monster High A', 'Classic Monster High doll', 'Dolls', 19.99, 'monsterHighA.webp', 15),
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


INSERT INTO "Order" (
    "orderID",
    "customerID",
    "dateCreated",
    "status"
)
VALUES
    (1, 6, '2026-11-01 10:00:00', 'Delivered'),
    (2, 6, '2026-11-03 14:30:00', 'Pending'),
    (3, 4, '2026-10-15 09:00:00', 'Delivered');

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
