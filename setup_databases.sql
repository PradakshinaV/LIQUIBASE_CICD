-- Create Databases
CREATE DATABASE IF NOT EXISTS testdb_dev;
CREATE DATABASE IF NOT EXISTS testdb_qa;
CREATE DATABASE IF NOT EXISTS testdb_prod;

-- Create Users
CREATE USER IF NOT EXISTS 'dev_user'@'localhost' IDENTIFIED BY 'DevPass123!';
CREATE USER IF NOT EXISTS 'qa_user'@'localhost' IDENTIFIED BY 'QaPass123!';
CREATE USER IF NOT EXISTS 'prod_user'@'localhost' IDENTIFIED BY 'ProdPass123!';

-- Grant Privileges
GRANT ALL PRIVILEGES ON testdb_dev.* TO 'dev_user'@'localhost';
GRANT ALL PRIVILEGES ON testdb_qa.* TO 'qa_user'@'localhost';
GRANT ALL PRIVILEGES ON testdb_prod.* TO 'prod_user'@'localhost';
FLUSH PRIVILEGES;

-- Show Databases
SHOW DATABASES;

-- Use testdb_dev for table creation
USE testdb_dev;

-- Department Table
CREATE TABLE IF NOT EXISTS department (
  dept_id INT AUTO_INCREMENT PRIMARY KEY,
  dept_name VARCHAR(100) NOT NULL,
  location VARCHAR(100)
);

-- Employee Table
CREATE TABLE IF NOT EXISTS employee (
  emp_id INT AUTO_INCREMENT PRIMARY KEY,
  emp_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE,
  phone VARCHAR(15),
  hire_date DATE,
  dept_id INT,
  FOREIGN KEY (dept_id) REFERENCES department(dept_id)
);

-- Role Table
CREATE TABLE IF NOT EXISTS role (
  role_id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL,
  description VARCHAR(255)
);

-- Employee_Role Mapping Table
CREATE TABLE IF NOT EXISTS employee_role (
  emp_id INT,
  role_id INT,
  assigned_date DATE DEFAULT (CURRENT_DATE),
  PRIMARY KEY (emp_id, role_id),
  FOREIGN KEY (emp_id) REFERENCES employee(emp_id),
  FOREIGN KEY (role_id) REFERENCES role(role_id)
);

-- Salary Table
CREATE TABLE IF NOT EXISTS salary (
  salary_id INT AUTO_INCREMENT PRIMARY KEY,
  emp_id INT,
  amount DECIMAL(10,2),
  effective_from DATE,
  FOREIGN KEY (emp_id) REFERENCES employee(emp_id)
);

-- Insert Sample Data
INSERT INTO department (dept_name, location)
VALUES ('IT', 'Bangalore'),
       ('HR', 'Chennai'),
       ('Finance', 'Hyderabad')
ON DUPLICATE KEY UPDATE dept_name=dept_name;

INSERT INTO role (role_name, description)
VALUES ('Developer', 'Writes code'),
       ('HR Manager', 'Manages HR operations'),
       ('Accountant', 'Manages finances')
ON DUPLICATE KEY UPDATE role_name=role_name;

INSERT INTO employee (emp_name, email, phone, hire_date, dept_id)
VALUES ('Arun Kumar', 'arun.k@company.com', '9876543210', '2023-05-10', 1),
       ('Divya Patel', 'divya.p@company.com', '9865321470', '2024-02-22', 2),
       ('Ravi Iyer', 'ravi.i@company.com', '9958432170', '2022-08-12', 3)
ON DUPLICATE KEY UPDATE emp_name=emp_name;

INSERT INTO employee_role (emp_id, role_id)
VALUES (1, 1), (2, 2), (3, 3)
ON DUPLICATE KEY UPDATE emp_id=emp_id;

INSERT INTO salary (emp_id, amount, effective_from)
VALUES (1, 75000, '2023-05-10'),
       (2, 60000, '2024-02-22'),
       (3, 80000, '2022-08-12')
ON DUPLICATE KEY UPDATE amount=amount;

-- Query Data
SELECT * FROM employee;
SELECT * FROM department;

-- Transaction Test 1 (Rollback)
START TRANSACTION;
UPDATE salary SET amount = amount + 5000 WHERE emp_id = 1;
ROLLBACK;
SELECT * FROM salary WHERE emp_id = 1;

-- Transaction Test 2 (Commit)
START TRANSACTION;
UPDATE salary SET amount = amount + 5000 WHERE emp_id = 1;
COMMIT;
SELECT * FROM salary WHERE emp_id = 1;

-- Check DATABASECHANGELOG
SELECT * FROM DATABASECHANGELOG;

-- Show Users
SELECT user, host FROM mysql.user WHERE user LIKE '%dev%' OR user LIKE '%qa%' OR user LIKE '%prod%';

-- Show Tables
USE testdb_dev;
SHOW TABLES;
DESCRIBE users;

-- Check Roles Table
DESCRIBE roles;
SELECT * FROM roles;

-- Check Foreign Keys
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'testdb_dev'
AND REFERENCED_TABLE_NAME IS NOT NULL;

-- Show Indexes
SHOW INDEX FROM users;

-- Check DATABASECHANGELOG
USE testdb_dev;
SELECT * FROM databasechangelog ORDER BY dateexecuted DESC;

-- Describe users table
DESCRIBE users;


