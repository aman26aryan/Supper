-- db_init.sql
CREATE DATABASE IF NOT EXISTS supper_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE supper_db;

CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150),
  phone VARCHAR(30),
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS restaurants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  cuisine VARCHAR(80),
  rating DECIMAL(3,2) DEFAULT 0,
  avg_time INT,
  description TEXT,
  address TEXT,
  image VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS menu_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  restaurant_id INT NOT NULL,
  category VARCHAR(80),
  name VARCHAR(150) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  image VARCHAR(255),
  available TINYINT(1) DEFAULT 1,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS delivery_agents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  phone VARCHAR(30),
  vehicle VARCHAR(80),
  status VARCHAR(30) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_uid VARCHAR(50) UNIQUE,
  customer_id INT,
  restaurant_id INT NOT NULL,
  delivery_agent_id INT,
  delivery_address TEXT,
  subtotal DECIMAL(10,2),
  status ENUM('new','preparing','out','assigned','picked','delivered','rejected') DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (delivery_agent_id) REFERENCES delivery_agents(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  menu_item_id INT,
  name VARCHAR(150),
  qty INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Seed: 3 restaurants + menus + demo driver + demo customer
INSERT INTO restaurants (name,cuisine,rating,avg_time,description,address,image) VALUES
('Pasta Paradise','Italian',4.5,25,'Fresh pasta & sauces','MG Road, Bangalore','/images/restaurants/pasta-paradise.jpeg'),
('Wok This Way','Chinese',4.2,30,'Stir-fries & noodles','Koramangala, Bangalore','/images/restaurants/wok.jpeg'),
('Green Bowl','Healthy',4.8,20,'Salads & bowls','Indiranagar, Bangalore','/images/restaurants/greenbowl.jpeg');

INSERT INTO menu_items (restaurant_id,category,name,description,price,image) VALUES
(1,'Pasta','Spaghetti Carbonara','Creamy, bacon',220.00,'/images/dishes/spag.jpeg'),
(1,'Pasta','Penne Arrabiata','Spicy tomato',180.00,'/images/dishes/pene.jpeg'),
(1,'Sides','Garlic Bread','With herbs',70.00,'/images/dishes/garlic.jpeg'),
(2,'Noodles','Hakka Noodles','Veg / Chicken',160.00,'/images/dishes/haka.jpeg'),
(2,'Noodles','Chili Chicken','Hot & tangy',240.00,'/images/dishes/chilli.jpeg'),
(2,'Dimsum','Veg Momos','Steamed',90.00,'/images/dishes/veg.jpeg'),
(3,'Bowls','Quinoa Bowl','Veggie power',260.00,'/images/dishes/quoina.jpeg'),
(3,'Bowls','Protein Bowl','Chicken + egg',320.00,'/images/dishes/protein.jpeg');

INSERT INTO delivery_agents (name,phone,vehicle) VALUES ('Demo Driver','8888888888','Bike');
INSERT INTO customers (name,email,phone,address) VALUES ('Demo Customer','demo@example.com','9999999999','MG Road, Bangalore');
