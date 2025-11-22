class Recipient {
  constructor(row) {
    this.id = row.id;
    this.smartTimerId = row.smartTimerId !== undefined ? row.smartTimerId : row.smartTimer_id || row.smartTimerId || row.smarttimerid;
    this.deviceId = row.deviceId !== undefined ? row.deviceId : row.device_id;
    this.userId = row.userId !== undefined ? row.userId : row.user_id;
    this.type = row.type;
    this.target = row.target;
    this.createdAt = row.createdAt !== undefined ? row.createdAt : row.created_at;
  }
}
module.exports = Recipient;
