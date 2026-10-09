import nodemailer from 'nodemailer';

export const paymentNotificationRecipient='rodrickgao@gmail.com';
export function paymentNotificationEmail({order,user,endsAt}) {
 const date=value=>new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Hong_Kong'});
 return {
  to:paymentNotificationRecipient,
  messageId:`<payment-${order.id}@ddphysics.com>`,
  subject:'ddphysics · 新会员已开通',
  text:[
   '学生已点击“我已付款”，会员已开通。',
   `用户名：${user.nickname||'未填写'}`,`邮箱：${user.email}`,
   `金额：¥${(order.amount_fen/100).toFixed(2)}`,
   `付款方式：${({wechat:'微信支付',alipay:'支付宝'})[order.payment_method]||'付款截图'}`,
   `会员时长：${order.days} 天`,`开通时间：${date(order.granted_at)}`,
   `到期时间：${date(endsAt)}`,`订单：${order.id}`,
   '待核对实际收款。','查看后台：https://ddphysics.com/admin.html#payments'
  ].join('\n')
 };
}

export function smtpPaymentNotifier(env=process.env) {
 if(!['SMTP_HOST','SMTP_FROM','SMTP_USER','SMTP_PASS'].every(k=>env[k])) return undefined;
 const transport=nodemailer.createTransport({host:env.SMTP_HOST,port:Number(env.SMTP_PORT||465),secure:env.SMTP_PORT!=='587',requireTLS:true,auth:{user:env.SMTP_USER,pass:env.SMTP_PASS},connectionTimeout:10000,socketTimeout:15000});
 return message=>transport.sendMail({...message,from:env.SMTP_FROM});
}

export function createPaymentNotifications({db,clock,sendMail}) {
 db.exec(`CREATE TABLE IF NOT EXISTS payment_notifications (
  order_id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at INTEGER NOT NULL,
  sent_at INTEGER, attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL);`);
 let busy=false,closed=false;
 function enqueue(order,user,endsAt) {
  db.prepare('INSERT OR IGNORE INTO payment_notifications(order_id,payload,created_at,next_at) VALUES(?,?,?,?)').run(order.id,JSON.stringify(paymentNotificationEmail({order,user,endsAt})),clock(),clock());
 }
 async function flush() {
  if(!sendMail||closed||busy)return;
  busy=true;
  try {
   const rows=db.prepare('SELECT * FROM payment_notifications WHERE sent_at IS NULL AND next_at<=? ORDER BY created_at LIMIT 20').all(clock());
   for(const row of rows) {
    if(closed)break;
    try {
     await sendMail(JSON.parse(row.payload));
     if(!closed)db.prepare('UPDATE payment_notifications SET sent_at=?,attempts=attempts+1 WHERE order_id=?').run(clock(),row.order_id);
    } catch {
     if(!closed)db.prepare('UPDATE payment_notifications SET attempts=attempts+1,next_at=? WHERE order_id=?').run(clock()+Math.min(3600000,60000*2**Math.min(row.attempts,6)),row.order_id);
    }
   }
  } finally {busy=false;}
 }
 const timer=sendMail?setInterval(()=>{void flush();},30000):null;
 timer?.unref();
 return {enqueue,flush,close(){closed=true;if(timer)clearInterval(timer);}};
}
