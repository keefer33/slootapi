# User Utilities

This directory contains utility functions for managing user data and authentication across the application.

## userUtils.ts

A comprehensive utility module for user management that provides both global state management and database operations.

### Key Features

- **Global User State**: Maintain current user in memory for easy access
- **Database Operations**: Fetch and update user data from Supabase
- **Balance Management**: Check, deduct, and add user credits
- **Request Integration**: Extract user data from Express requests

### Usage Examples

#### Basic User Access

```typescript
import { getUser, getCurrentUser } from '../utils/userUtils';

// In a route handler (recommended)
const user = getUser(req);
if (!user) {
  return res.status(401).json({ error: 'Not authenticated' });
}

// In any other file (after middleware has run)
const user = getCurrentUser();
if (user) {
  console.log('Current user:', user.email);
}
```

#### Database Operations

```typescript
import { getUserById, getUserByEmail } from '../utils/userUtils';

// Get user by ID
const user = await getUserById('user-123');

// Get user by email
const user = await getUserByEmail('user@example.com');
```

#### Balance Management

```typescript
import {
  hasSufficientBalance,
  deductUserBalance,
  addUserBalance,
} from '../utils/userUtils';

// Check if user has enough credits
const hasBalance = await hasSufficientBalance(userId, 0.01);

// Deduct credits
const success = await deductUserBalance(userId, 0.01);

// Add credits
const success = await addUserBalance(userId, 1.0);
```

### Available Functions

| Function                               | Description                           | Parameters                                   | Returns                 |
| -------------------------------------- | ------------------------------------- | -------------------------------------------- | ----------------------- |
| `getUser(req?)`                        | Get user from request or global state | `req?: Request`                              | `User \| null`          |
| `getCurrentUser()`                     | Get current global user               | -                                            | `User \| null`          |
| `setCurrentUser(user)`                 | Set global user state                 | `user: User`                                 | `void`                  |
| `clearCurrentUser()`                   | Clear global user state               | -                                            | `void`                  |
| `getUserFromRequest(req)`              | Get user from request object          | `req: Request`                               | `User \| null`          |
| `getUserById(userId)`                  | Fetch user from database by ID        | `userId: string`                             | `Promise<User \| null>` |
| `getUserByEmail(email)`                | Fetch user from database by email     | `email: string`                              | `Promise<User \| null>` |
| `updateUserProfile(userId, data)`      | Update user profile                   | `userId: string, data: Partial<UserProfile>` | `Promise<boolean>`      |
| `hasSufficientBalance(userId, amount)` | Check user balance                    | `userId: string, amount: number`             | `Promise<boolean>`      |
| `deductUserBalance(userId, amount)`    | Deduct from user balance              | `userId: string, amount: number`             | `Promise<boolean>`      |
| `addUserBalance(userId, amount)`       | Add to user balance                   | `userId: string, amount: number`             | `Promise<boolean>`      |

### Integration with Middleware

The JWT middleware automatically sets the global user state when a valid token is provided:

```typescript
// In jwtAuth.ts
const user = {
  /* user data */
};
setCurrentUser(user); // Automatically called by middleware
```

### Best Practices

1. **Use `getUser(req)` in route handlers** - This is the most reliable method
2. **Use `getCurrentUser()` in utility functions** - Only after middleware has run
3. **Always check for null** - User might not be authenticated
4. **Use database functions for persistence** - Global state is temporary
5. **Handle errors gracefully** - Database operations can fail

### Example Integration

```typescript
// In any route file
import {
  getUser,
  hasSufficientBalance,
  deductUserBalance,
} from '../utils/userUtils';

export const myRoute = async (req: Request, res: Response) => {
  const user = getUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const cost = 0.01;
  if (!(await hasSufficientBalance(user.userId, cost))) {
    return res.status(402).json({ error: 'Insufficient balance' });
  }

  // Process request...
  await deductUserBalance(user.userId, cost);

  res.json({ success: true });
};
```
