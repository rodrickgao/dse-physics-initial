import { databaseQueries } from './database.mjs';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
export function createPaymentOrders({ db, clock, fail, transaction, management, notifications }) {
  const { get, all, run } = databaseQueries(db);
  db.exec(`CREATE TABLE IF NOT EXISTS payment_orders(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),request_id TEXT NOT NULL,amount_fen INTEGER NOT NULL,days INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')),created_at INTEGER NOT NULL,reviewed_at INTEGER,reviewed_by INTEGER REFERENCES users(id),UNIQUE(user_id,request_id));
    CREATE UNIQUE INDEX IF NOT EXISTS one_pending_payment ON payment_orders(user_id) WHERE status='pending';`);
  db.exec('CREATE TABLE IF NOT EXISTS payment_receipts(order_id TEXT PRIMARY KEY REFERENCES payment_orders(id), image BLOB NOT NULL)');
  const columns = all('PRAGMA table_info(payment_orders)').map(c => c.name);
  if (!columns.includes('granted_at')) db.exec('ALTER TABLE payment_orders ADD COLUMN granted_at INTEGER');
  if (!columns.includes('rejection_reason')) db.exec('ALTER TABLE payment_orders ADD COLUMN rejection_reason TEXT');
  if (!columns.includes('payment_method')) db.exec('ALTER TABLE payment_orders ADD COLUMN payment_method TEXT');
  function grant(order, actorId) {
    const before=management.membership(order.user_id), end=Math.max(clock(),before.active?before.endsAt:0)+order.days*86400000;
    run('INSERT INTO memberships VALUES(?,?,0,?) ON CONFLICT(user_id) DO UPDATE SET ends_at=excluded.ends_at,revoked=0,revision=excluded.revision',order.user_id,end,before.revision+1);
    run('INSERT INTO membership_audit(request_id,user_id,actor_id,action,days,reason,before_end,after_end,at) VALUES(?,?,?,?,?,?,?,?,?)','payment-'+order.id,order.user_id,actorId,'extend',order.days,'用户确认付款后开通 · '+order.id,before.endsAt,end,clock());
    run('UPDATE payment_orders SET granted_at=? WHERE id=?',clock(),order.id);
    notifications?.enqueue({...order,granted_at:clock()},get('SELECT email,nickname FROM users WHERE id=?',order.user_id),end);
  }
  async function submit(user,body) {
    if(user.role!=='student')fail(403,'仅学生可提交付款申请。');
    if(typeof body.requestId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(body.requestId))fail(400,'无效的申请编号。');
    const paymentMethod = body.paymentMethod ?? null;
    if (paymentMethod !== null && !['wechat','alipay'].includes(paymentMethod)) fail(400, '请选择微信或支付宝。');
    if (!body.receipt && !paymentMethod) fail(400, '请选择支付方式。');
    let receipt;
    // Existing clients and historical receipts remain supported.
    if (body.receipt !== undefined) {
    const match = typeof body.receipt === 'string' && /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(body.receipt);
    if (!match) fail(400, '请上传付款成功截图（JPG、PNG 或 WebP）。');
    const input = Buffer.from(match[1], 'base64');
    if (input.length > 5 * 1024 * 1024) fail(413, '截图不能超过 5MB。');
    try {
      const photo = sharp(input, {limitInputPixels: 24000000, animated: false});
      const metadata = await photo.metadata();
      if (!['png','jpeg','webp'].includes(metadata.format) || (metadata.pages || 1) > 1) throw new Error('Invalid image');
      receipt = await photo.rotate().resize({width:2400,height:3600,fit:'inside',withoutEnlargement:true}).webp({quality:90}).toBuffer();
    } catch { fail(400, '截图无法读取，请重新选择 JPG、PNG 或 WebP 图片。'); }
    }
    return transaction(()=>{
      const prior=get('SELECT * FROM payment_orders WHERE user_id=? AND request_id=?',user.id,body.requestId)||get("SELECT * FROM payment_orders WHERE user_id=? AND status='pending'",user.id);
      if(prior)return {order:prior};
      const id=randomUUID();run("INSERT INTO payment_orders(id,user_id,request_id,amount_fen,days,status,created_at) VALUES(?,?,?,?,?,'pending',?)",id,user.id,body.requestId,5900,30,clock());
      run('UPDATE payment_orders SET payment_method=? WHERE id=?',paymentMethod,id);
      if (receipt) run('INSERT INTO payment_receipts VALUES(?,?)',id,receipt);
      grant(get('SELECT * FROM payment_orders WHERE id=?',id),user.id);
      return {order:get('SELECT * FROM payment_orders WHERE id=?',id)};
    });
  }
  function review(actor,body){
    if(actor.role!=='admin')fail(403,'仅管理员可以处理订单。');
    if(!['approve','reject'].includes(body.action)||typeof body.orderId!=='string')fail(400,'无效的订单操作。');
    return transaction(()=>{
      const order=get('SELECT * FROM payment_orders WHERE id=?',body.orderId);if(!order)fail(404,'订单不存在。');
      const status=body.action==='approve'?'approved':'rejected';
      if(order.status===status)return {order,duplicate:true};
      if(order.status!=='pending')fail(409,'订单已处理，请刷新。');
      if(status==='approved' && !order.granted_at) grant(order,actor.id);
      if(status==='rejected') {
        if(typeof body.reason!=='string' || !body.reason.trim() || body.reason.trim().length>300) fail(400,'请填写不通过理由（1–300 字）。');
        const before=management.membership(order.user_id);
        run('UPDATE memberships SET revoked=1,revision=revision+1 WHERE user_id=?',order.user_id);
        run('INSERT INTO membership_audit(request_id,user_id,actor_id,action,days,reason,before_end,after_end,at) VALUES(?,?,?,?,?,?,?,?,?)','payment-reject-'+order.id,order.user_id,actor.id,'revoke',0,body.reason.trim(),before.endsAt,before.endsAt,clock());
        run('UPDATE payment_orders SET rejection_reason=? WHERE id=?',body.reason.trim(),order.id);
      }
      run('UPDATE payment_orders SET status=?,reviewed_at=?,reviewed_by=? WHERE id=?',status,clock(),actor.id,order.id);
      return {order:get('SELECT * FROM payment_orders WHERE id=?',order.id)};
    });
  }
  return {submit,review,receipt:id=>{const row=get('SELECT image FROM payment_receipts WHERE order_id=?',id);if(!row)fail(404,'此申请没有付款截图。');return Buffer.from(row.image);},latest:id=>get('SELECT * FROM payment_orders WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1',id)||null,
    list:()=>({pending:all("SELECT o.*,u.email,u.nickname,EXISTS(SELECT 1 FROM payment_receipts WHERE order_id=o.id) AS hasReceipt FROM payment_orders o JOIN users u ON u.id=o.user_id WHERE o.status='pending' ORDER BY o.created_at"),recent:all("SELECT o.*,u.email,u.nickname,EXISTS(SELECT 1 FROM payment_receipts WHERE order_id=o.id) AS hasReceipt FROM payment_orders o JOIN users u ON u.id=o.user_id WHERE o.status!='pending' ORDER BY o.reviewed_at DESC LIMIT 100")})};
}
