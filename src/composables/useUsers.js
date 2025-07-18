// src/composables/useUsers.js
import { reactive, computed, ref } from 'vue';

const base = import.meta.env.BASE_URL;

const users = reactive({});         // userId => user object

// Example: The "current user" could be managed as a ref or computed
const currentUser = computed(() =>
  Object.values(users).find(u => u.active) || null
);

// Filtered/visible users (adjust as needed)
const visibleUsers = computed(() =>
  Object.values(users).filter(u => u.active !== false)
);

export function useUsers({ socket }) {
  // --- API methods ---
  async function fetchUsers() {
    const res = await fetch(`${base}api/users`);
    if (!res.ok) throw new Error('Failed to fetch users');
    const usersArray = await res.json();
    usersArray.forEach(u => users[u.id] = u);
    return usersArray;
  }

  async function getUserById(userId) {
    const res = await fetch(`${base}api/users/${userId}`);
    if (!res.ok) throw new Error('User not found');
    const user = await res.json();
    users[user.id] = user;
    return user;
  }

  function getUserByUsername(username) {
    console.log("WHAT IS USERNAME?:", username)
    console.log("what is users?", users)
    return Object.values(users).find(u => u.username === username) || null;
  }
  // async function getUserByUsername(username) {
  //   const res = await fetch(`${base}api/users?username=${encodeURIComponent(username)}`);
  //   if (!res.ok) throw new Error('Failed to query by username');
  //   const arr = await res.json();
  //   console.log("In getUserByUsername is arr something?", arr)
  //   if (arr.length > 0) {
  //     users[arr[0].id] = arr[0];
  //     return arr[0];
  //   }
  //   return null;
  // }

  async function createUser(username, email = null) {
    const res = await fetch(`${base}api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(email ? { username, email } : { username }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create user');
    }
    const user = await res.json();
    users[user.id] = user;
    return user;
  }

  async function updateUser(userId, data) {
    const res = await fetch(`${base}api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update user');
    const user = await res.json();
    users[user.id] = user;
    return user;
  }

  async function deleteUser(userId) {
    const res = await fetch(`${base}api/users/${userId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete user');
    delete users[userId];
  }

  // --- Session helpers ---
  function login(user) {
    currentUser.value = user;
  }
  function logout() {
    currentUser.value = null;
  }


  if (socket) {
      // Single user update (create, update, etc)
      socket.on('user:created', user => {
          users[user.id] = user;
      });
      socket.on('user:updated', user => {
          users[user.id] = user;
      });
      socket.on('user:deactivated', user => {
          users[user.id] = user;
      });
      socket.on('user:reactivated', user => {
          users[user.id] = user;
      });

      // Full users snapshot (hydration)
      socket.on('users:snapshot', (usersArray) => {
          Object.keys(users).forEach(id => { delete users[id]; });
          usersArray.forEach(user => {
              users[user.id] = user;
          });
              console.log("users (in-mem) after snapshot:", Object.values(users));

      });
  }  

  // --- Public API ---
  return {
    users,
    currentUser,
    fetchUsers,
    getUserById,
    getUserByUsername,
    createUser,
    updateUser,
    deleteUser,
    login,
    logout,
  };
}
