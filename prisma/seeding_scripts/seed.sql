DELETE FROM "Product";

INSERT INTO "Product"(
    "productName",
    "productDescription",
    "productPrice",
    "productImage",
    "productStock"
)
VALUES
    ('Marble', 'Bold and shiny, perfect for all your taskmaster needs', 30.88, 'products_images/marble.jpeg', 10),
    ('Pool Ball', 'Perfect for your pool table adventures', 29.99, 'products_images/pool_ball.jpg', 15),
    ('Trampoline', 'Fun for all ages, perfect for outdoor play', 1.09, 'products_images/trampoline.jpeg', 20),
    ('Pokemon', 'Catch them all with this exciting collectible', 45.00, 'products_images/pokemon.jpeg', 5),
    ('Callum', 'A unique collectible for fans of Callum', 0.38, 'products_images/callum.jpeg', 50),
    ('Lee', 'Perfect for collectors of Lee memorabilia', 30000.00, 'products_images/lee.jpeg', 1),
    ('Teddy', 'Bold and shiny, perfect for all your taskmaster needs', 62.23, 'products_images/teddy.jpeg', 8),
    ('Jacks', 'Classic game for all ages', 0.99, 'products_images/jacks.jpg', 25),
    ('Playing Cards', 'Fun for all ages, perfect for outdoor play', 1.09, 'products_images/playing_cards.jpeg', 30),
    ('Furby', 'It will never leave you', 100.00, 'products_images/furby.jpeg', 3),
    ('Lego', 'Singular lego', 0.38, 'products_images/lego.jpeg', 40),
    ('Barbie', 'Classic doll for imaginative play', 15.00, 'products_images/barbie.jpeg', 12),
    ('David', 'Batteries not included', 0.39, 'products_images/david.jpeg', 60);