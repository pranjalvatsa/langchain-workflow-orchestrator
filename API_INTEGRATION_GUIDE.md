# LangChain Workflow Orchestrator - API Integration Guide

## 🎉 Authentication System Fixed!

Your LangChain Workflow Orchestrator is now successfully deployed and the authentication system is working properly. Here's everything you need to integrate with your localhost application.

## Base URL
```
https://langchain-workflow-orchestrator.onrender.com
```

## Authentication Endpoints

### 1. User Registration
**Endpoint:** `POST /api/auth/register`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "noamUserId": "optional-custom-id"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "noamUserId": "noam_1759403303199_27cuzyw0s",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user",
      "isActive": true,
      "_id": "68de5d27c26915f6c7015c18"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 604800000
    }
  }
}
```

### 2. User Login
**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "noamUserId": "noam_1759403303199_27cuzyw0s",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user",
      "loginCount": 1,
      "lastLoginAt": "2025-10-02T11:07:59.114Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 604800000
    }
  }
}
```

## JavaScript Integration Examples

### 1. Registration Example
```javascript
async function registerUser(userData) {
  try {
    const response = await fetch('https://langchain-workflow-orchestrator.onrender.com/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
        noamUserId: userData.noamUserId // optional
      })
    });

    const data = await response.json();

    if (response.ok) {
      // Store tokens securely
      localStorage.setItem('accessToken', data.data.tokens.accessToken);
      localStorage.setItem('refreshToken', data.data.tokens.refreshToken);
      
      return {
        success: true,
        user: data.data.user,
        tokens: data.data.tokens
      };
    } else {
      return {
        success: false,
        error: data.error || data.message
      };
    }
  } catch (error) {
    return {
      success: false,
      error: 'Network error: ' + error.message
    };
  }
}
```

### 2. Login Example
```javascript
async function loginUser(email, password) {
  try {
    const response = await fetch('https://langchain-workflow-orchestrator.onrender.com/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password
      })
    });

    const data = await response.json();

    if (response.ok) {
      // Store tokens securely
      localStorage.setItem('accessToken', data.data.tokens.accessToken);
      localStorage.setItem('refreshToken', data.data.tokens.refreshToken);
      
      return {
        success: true,
        user: data.data.user,
        tokens: data.data.tokens
      };
    } else {
      return {
        success: false,
        error: data.error || data.message
      };
    }
  } catch (error) {
    return {
      success: false,
      error: 'Network error: ' + error.message
    };
  }
}
```

### 3. Authenticated API Calls
```javascript
async function makeAuthenticatedRequest(endpoint, options = {}) {
  const accessToken = localStorage.getItem('accessToken');
  
  if (!accessToken) {
    throw new Error('No access token found. Please login first.');
  }

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      ...options.headers
    }
  };

  try {
    const response = await fetch(`https://langchain-workflow-orchestrator.onrender.com${endpoint}`, config);
    
    if (response.status === 401) {
      // Token expired, try to refresh
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        // Retry with new token
        config.headers.Authorization = `Bearer ${localStorage.getItem('accessToken')}`;
        return await fetch(`https://langchain-workflow-orchestrator.onrender.com${endpoint}`, config);
      } else {
        throw new Error('Authentication failed. Please login again.');
      }
    }
    
    return response;
  } catch (error) {
    throw error;
  }
}
```

### 4. Token Refresh (if implemented)
```javascript
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  
  if (!refreshToken) {
    return false;
  }

  try {
    const response = await fetch('https://langchain-workflow-orchestrator.onrender.com/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${refreshToken}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('accessToken', data.tokens.accessToken);
      localStorage.setItem('refreshToken', data.tokens.refreshToken);
      return true;
    } else {
      // Refresh failed, remove tokens
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      return false;
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
    return false;
  }
}
```

## React Integration Example

```jsx
import React, { useState, useEffect, createContext, useContext } from 'react';

// Auth Context
const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      // Verify token is still valid (optional)
      verifyToken(token).then(userData => {
        if (userData) {
          setUser(userData);
        }
      });
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const result = await loginUser(email, password);
      if (result.success) {
        setUser(result.user);
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const register = async (userData) => {
    try {
      const result = await registerUser(userData);
      if (result.success) {
        setUser(result.user);
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      register,
      logout,
      isAuthenticated: !!user
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Usage in a component
const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(email, password);
    if (result.success) {
      console.log('Login successful!');
    } else {
      console.error('Login failed:', result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      <button type="submit">Login</button>
    </form>
  );
};
```

## Error Handling

### Common Error Responses
- **400 Bad Request:** Missing or invalid data
- **401 Unauthorized:** Invalid credentials or expired token
- **409 Conflict:** User already exists (registration)
- **500 Internal Server Error:** Server error

### Best Practices
1. Always check response status before parsing JSON
2. Store tokens securely (consider httpOnly cookies for production)
3. Implement token refresh logic
4. Handle network errors gracefully
5. Provide user-friendly error messages

## Testing from Command Line

### Using curl:
```bash
# Register a user
curl -X POST https://langchain-workflow-orchestrator.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User"
  }'

# Login
curl -X POST https://langchain-workflow-orchestrator.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

## 🎯 Summary

✅ **MongoDB Atlas:** Connected and working  
✅ **User Registration:** Working with proper field validation  
✅ **User Login:** Working with JWT token generation  
✅ **CORS:** Configured for localhost access  
✅ **Error Handling:** Improved with detailed error messages  

Your authentication system is now fully functional and ready for integration with your localhost application!