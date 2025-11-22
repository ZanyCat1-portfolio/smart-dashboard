const { reactive } = require('vue');
const userDAL = require('../dal/user-dal');
const eventBus = require('../utils/eventBus');

const users = reactive({});
// console.log("[users] does users rehydrate?")

function rehydrateUsers() {
  const allUsers = userDAL.listUsers();
  for (const key in users) delete users[key]; // reset reactive object in-place
  allUsers.forEach(user => {
    users[user.id] = user;
  });
  eventBus.emit('users:snapshot', Object.values(users));
}

rehydrateUsers();
// console.log("this is users now: ", users)

module.exports = {
  users,
  rehydrateUsers
} 
