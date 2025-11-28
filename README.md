# FACTS - File and case tracking system

A comprehensive file and case tracking system designed for Baaseteen and SHND (Social Help and Development) organizations to manage welfare cases, counseling forms, and administrative workflows.

## 🚀 Features

### Core Functionality
- **Case Management**: Complete lifecycle management from registration to disbursement
- **Applicant Management**: Comprehensive applicant profiles with personal and family details
- **Counseling Forms**: Digital counseling forms with assessment and upliftment planning
- **Workflow Management**: Configurable approval workflows with multiple executive levels
- **File Management**: Secure file uploads and document management
- **Notifications**: Real-time notifications for status changes and updates

### User Management & Security
- **Role-Based Access Control (RBAC)**: Granular permissions system
- **User Authentication**: Secure JWT-based authentication
- **Multi-role Support**: Admin, DCM, Counselor, Welfare Reviewer, Executive, Finance
- **Jamiat/Jamaat Management**: Organizational hierarchy management

### Administrative Features
- **Master Data Management**: Case types, statuses, priorities, education levels, occupations
- **Dashboard Analytics**: Role-specific dashboards with statistics and insights
- **Audit Trails**: Complete activity logging and status history
- **Reports**: Comprehensive reporting capabilities

## 🏗️ Architecture

### Backend (Node.js/Express)
- **Framework**: Express.js with security middleware
- **Database**: MySQL with connection pooling
- **Authentication**: JWT tokens with bcrypt password hashing
- **File Upload**: Multer for handling file uploads
- **Email**: Nodemailer for notifications
- **Security**: Helmet, CORS, Rate limiting

### Frontend (React)
- **Framework**: React 18 with functional components and hooks
- **Routing**: React Router v6 with protected routes
- **State Management**: React Query for server state
- **Styling**: Tailwind CSS with custom components
- **Forms**: React Hook Form for form management
- **UI Components**: Custom reusable components

### Database Schema
- **Users & Roles**: Complete RBAC implementation
- **Cases & Applicants**: Core business entities
- **Workflow Management**: Configurable approval stages
- **Master Data**: Lookup tables for consistent data
- **Audit System**: Complete activity tracking

## 📋 Prerequisites

- **Node.js**: v16 or higher
- **MySQL**: v8.0 or higher
- **npm**: v8 or higher

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd baaseteen
```

### 2. Install Dependencies
```bash
# Install root dependencies
npm install

# Install all dependencies (backend + frontend)
npm run install-all
```

### 3. Database Setup
```bash
# Create MySQL database
mysql -u root -p
CREATE DATABASE baaseteen_cms;

# Import the complete production database schema
mysql -u root -p baaseteen_cms < database/baaseteen_production_database.sql
```

**Note**: The consolidated production database file (`database/baaseteen_production_database.sql`) includes all schema definitions and migrations in a single file for easy deployment.

### 4. Environment Configuration
Create `.env` files in both backend and root directories:

**Backend `.env`:**
```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=baaseteen_cms

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=24h

# Server Configuration
PORT=5000
NODE_ENV=development

# Email Configuration (Optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
```

**Root `.env`:**
```env
# Frontend Configuration
REACT_APP_API_URL=http://localhost:5000
REACT_APP_ENV=development
```

## 🚀 Running the Application

### Development Mode
```bash
# Start both backend and frontend concurrently
npm run dev

# Or start individually:
npm run backend  # Backend only (port 5000)
npm run frontend # Frontend only (port 3000)
```

### Production Mode
```bash
# Build frontend
npm run build

# Start backend in production
cd backend
npm start
```

## 🔐 Default Login Credentials

**Admin User:**
- Username: `admin`
- Email: `admin@baaseteen.com`
- Password: `password`

## 📁 Project Structure

```
baaseteen/
├── backend/                 # Backend API server
│   ├── config/             # Database and configuration
│   ├── middleware/         # Authentication and permissions
│   ├── routes/             # API route handlers
│   ├── services/           # Business logic services
│   ├── utils/              # Utility functions
│   ├── uploads/            # File upload storage
│   └── index.js            # Main server file
├── frontend/               # React frontend application
│   ├── public/             # Static assets
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── contexts/       # React contexts
│   │   ├── pages/          # Page components
│   │   ├── utils/          # Utility functions
│   │   └── App.js          # Main app component
│   └── build/              # Production build
├── database/
│   └── baaseteen_production_database.sql  # Consolidated production database schema
└── README.md               # This file
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Cases
- `GET /api/cases` - List all cases
- `POST /api/cases` - Create new case
- `GET /api/cases/:id` - Get case details
- `PUT /api/cases/:id` - Update case
- `DELETE /api/cases/:id` - Delete case

### Applicants
- `GET /api/applicants` - List applicants
- `POST /api/applicants` - Create applicant
- `GET /api/applicants/:id` - Get applicant details
- `PUT /api/applicants/:id` - Update applicant

### Counseling Forms
- `GET /api/counseling-forms` - List counseling forms
- `POST /api/counseling-forms` - Create counseling form
- `GET /api/counseling-forms/:id` - Get counseling form
- `PUT /api/counseling-forms/:id` - Update counseling form

### Users & Roles
- `GET /api/users` - List users
- `POST /api/users` - Create user
- `GET /api/roles` - List roles
- `POST /api/roles` - Create role

### Master Data
- `GET /api/case-types` - Case types
- `GET /api/statuses` - Case statuses
- `GET /api/jamiat` - Jamiat organizations
- `GET /api/jamaat` - Jamaat organizations

## 👥 User Roles & Permissions

### Admin
- Full system access
- User management
- Role management
- System configuration

### Deputy Case Manager (DCM)
- Case management
- Counseling form creation/editing
- Cover letter generation
- Case assignment

### Counselor
- Counseling form editing
- Case viewing
- Applicant information access

### Welfare Reviewer
- Case review and approval
- Welfare department decisions
- Case status updates

### Executive
- Final case approval
- Executive level decisions
- Case oversight

### Finance
- Financial disbursement tracking
- Payment processing
- Financial reports

## 🔄 Workflow Process

1. **Case Registration**: Admin/DCM creates new case
2. **Assignment**: Case assigned to DCM and Counselor
3. **Counseling**: Counselor fills counseling form
4. **Cover Letter**: DCM generates cover letter
5. **Welfare Review**: Submitted to welfare department
6. **Executive Approval**: Multi-level executive approval
7. **Finance Disbursement**: Final payment processing

## 📊 Dashboard Features

### Admin Dashboard
- System overview statistics
- User management metrics
- Recent case activities
- System health monitoring

### DCM Dashboard
- Assigned cases overview
- Counseling progress tracking
- Pending tasks
- Case pipeline status

### Welfare Dashboard
- Pending review cases
- Approval statistics
- Review queue management
- Performance metrics

## 🛡️ Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt for password security
- **Rate Limiting**: API rate limiting protection
- **CORS Configuration**: Cross-origin request security
- **Input Validation**: Joi schema validation
- **SQL Injection Protection**: Parameterized queries
- **File Upload Security**: Type and size validation

## 📱 File Management

### Supported File Types
- Documents: PDF, DOC, DOCX
- Images: JPG, JPEG, PNG
- Maximum size: 10MB per file

### File Categories
- General documents
- Financial statements
- Income tax returns
- Product brochures
- Quotations
- Work place photos
- Other documents

## 🔧 Configuration

### Database Configuration
The system uses MySQL with the following key tables:
- `users` - User accounts and profiles
- `cases` - Case management
- `applicants` - Applicant information
- `counseling_forms` - Counseling form data
- `roles` - Role definitions
- `permissions` - Permission system
- `jamiat`/`jamaat` - Organizational hierarchy

### Environment Variables
All configuration is managed through environment variables for security and flexibility.

## 🚀 Deployment

### Production Deployment

#### Prerequisites
- Production server with Node.js v16+ installed
- MySQL v8.0+ database server
- Domain name and SSL certificate (recommended)
- Reverse proxy (nginx/Apache) configured

#### Step 1: Server Setup
```bash
# Clone repository on production server
git clone <repository-url>
cd baaseteen

# Install dependencies
npm install
cd backend && npm install
cd ../frontend && npm install
```

#### Step 2: Database Setup
```bash
# Create production database
mysql -u root -p
CREATE DATABASE baaseteen_cms;

# Import production database schema
mysql -u root -p baaseteen_cms < database/baaseteen_production_database.sql

# Verify database import
mysql -u root -p baaseteen_cms -e "SHOW TABLES;"
```

#### Step 3: Environment Configuration

**Backend `.env` (Production):**
```env
# Database Configuration
DB_HOST=your_production_db_host
DB_USER=your_db_user
DB_PASSWORD=your_secure_password
DB_NAME=baaseteen_cms

# JWT Configuration (USE STRONG SECRET IN PRODUCTION)
JWT_SECRET=your_very_secure_random_secret_key_min_32_chars
JWT_EXPIRES_IN=24h

# Server Configuration
PORT=5000
NODE_ENV=production

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# API URL (for frontend)
API_URL=https://your-domain.com/api
```

**Frontend `.env` (Production):**
```env
REACT_APP_API_URL=https://your-domain.com/api
REACT_APP_ENV=production
```

#### Step 4: Build Frontend
```bash
cd frontend
npm run build

# The build folder will be created with production-ready files
```

#### Step 5: Start Backend Server

**Option A: Using PM2 (Recommended)**
```bash
# Install PM2 globally
npm install -g pm2

# Start backend with PM2
cd backend
pm2 start index.js --name baaseteen-backend

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system reboot
pm2 startup
```

**Option B: Using systemd service**
```bash
# Create systemd service file
sudo nano /etc/systemd/system/baaseteen.service
```

Add the following content:
```ini
[Unit]
Description=Baaseteen CMS Backend
After=network.target

[Service]
Type=simple
User=your_user
WorkingDirectory=/path/to/baaseteen/backend
ExecStart=/usr/bin/node index.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Then enable and start:
```bash
sudo systemctl enable baaseteen
sudo systemctl start baaseteen
```

#### Step 6: Configure Reverse Proxy (Nginx)

Create nginx configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/ssl/certificate.crt;
    ssl_certificate_key /path/to/ssl/private.key;

    # Frontend
    location / {
        root /path/to/baaseteen/frontend/build;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # File uploads
    client_max_body_size 10M;
}
```

Reload nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

#### Step 7: Security Considerations

1. **Change Default Admin Password**: Immediately change the default admin password after first login
2. **Firewall Configuration**: Only allow necessary ports (80, 443, 22)
3. **Database Security**: Use strong passwords and restrict database access
4. **SSL/TLS**: Always use HTTPS in production
5. **Environment Variables**: Never commit `.env` files to version control
6. **Regular Backups**: Set up automated database backups
7. **Monitoring**: Configure logging and monitoring tools
8. **Updates**: Keep dependencies updated for security patches

#### Step 8: Post-Deployment Checklist

- [ ] Database imported successfully
- [ ] Environment variables configured
- [ ] Frontend built and deployed
- [ ] Backend server running
- [ ] Reverse proxy configured
- [ ] SSL certificate installed
- [ ] Default admin password changed
- [ ] File upload directory has proper permissions
- [ ] Backups configured
- [ ] Monitoring/logging setup

#### Production Database File

The production database file (`database/baaseteen_production_database.sql`) is a consolidated file containing:
- Complete database schema
- All table definitions
- All migrations in correct order
- Default data and configurations
- Indexes for performance optimization

This single file replaces all individual migration files for easier production deployment.

### Docker Deployment (Optional)
```bash
# Build and run with Docker
docker-compose up -d
```

## 🧪 Testing

### Backend Testing
```bash
cd backend
npm test
```

### Frontend Testing
```bash
cd frontend
npm test
```

## 📈 Monitoring & Logging

- **Health Check**: `/health` endpoint for monitoring
- **Error Logging**: Comprehensive error tracking
- **Activity Logs**: User activity audit trails
- **Performance Monitoring**: Database query optimization

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## 🔄 Version History

- **v1.0.0** - Initial release with core functionality
- Complete case management system
- Role-based access control
- Workflow management
- File upload system
- Dashboard analytics

## 📋 TODO / Roadmap

- [ ] Mobile application
- [ ] Advanced reporting features
- [ ] Email notifications
- [ ] API documentation
- [ ] Performance optimization
- [ ] Multi-language support

---

**FACTS - File and case tracking system** - Streamlining file and case tracking for better social impact.#   F A C T S  
 #   F A C T S  
 #   F A C T S  
 #   F A C T S  
 