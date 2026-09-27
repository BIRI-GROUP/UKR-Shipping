import {validateRoute,readRoutes} from './routes.mjs';
import {routeKey} from './rates.mjs';
// Approved regular routes, without prices or inventory. Run once; preserve all staff edits.
export async function addApprovedChinaRoutes(store) {
  await store.tx(async db=>{
    const key='migration-china-routes-20260927';
    if((await db.query('SELECT value FROM ukr_sequences WHERE name=$1',[key])).rows.length)return;
    const existing=await readRoutes(db);
    const names=[
      ['Ningbo',['نينغبو','宁波','Нинбо','ننگبو','निंगबो']],
      ['Guangzhou',['GZ','قوانغتشو','广州','Гуанчжоу','گوانگژو','ग्वांगझोउ']],
      ['Nansha',['نانشا','南沙','Наньша','نانشا','नानशा']],
      ['Shenzhen',['Shenzen','شنتشن','深圳','Шэньчжэнь','شینژن','शेन्ज़ेन']],
      ['Shanghai',['Shanghi','شنغهاي','上海','Шанхай','شنگھائی','शंघाई']],
      ['Qingdao',['Qindao','تشينغداو','青岛','Циндао','چنگ ڈاؤ','छिंगदाओ']],
      ['Tianjin',['تيانجين','天津','Тяньцзинь','تیانجن','तियानजिन']],
      ['Hong Kong',['Hongkong','هونغ كونغ','香港','Гонконг','ہانگ کانگ','हांगकांग']],
      ['Beijing',['Beigine','Pékin','بكين','北京','Пекин','بیجنگ','बीजिंग']]
    ];
    for(const [name,aliases]of names){
      const origin=name+', China',destination='Jebel Ali, UAE';
      if(existing.some(r=>routeKey(r.origin)===routeKey(origin)&&routeKey(r.destination)===routeKey(destination)))continue;
      const data=validateRoute({active:true,origin,destination,originCountry:'China',destinationCountry:'UAE',airOrigin:'',airDestination:'',originAliases:aliases,destinationAliases:['Dubai','دبي','迪拜','Dubaï','Дубай','دبئی','दुबई','جبل علي','杰贝阿里','Джебель-Али','جبل علی','जेबेल अली'],products:['AIR','LCL','LCL_DDP','FCL20','FCL40','FCL45']});
      const id='ukr-cn-'+name.toLowerCase().replaceAll(' ','-')+'-ae-jebel-ali';
      await db.query('INSERT INTO freight_routes (id,version,active,data,updated_at) VALUES ($1,1,1,$2,$3)',[id,JSON.stringify(data),Date.now()]);
    }
    await db.query('INSERT INTO ukr_sequences (name,value) VALUES ($1,1)',[key]);
  });
}
