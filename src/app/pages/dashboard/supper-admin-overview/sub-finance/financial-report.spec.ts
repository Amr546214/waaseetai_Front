import { financialReportHtml } from './financial-report';
import type { AdminFinanceOverview, AdminTransaction } from '../../../../core/services/admin-ops-api.service';

const data: AdminFinanceOverview={currency:'USD',totals:{escrowHeldCount:2,escrowHeldAmount:1234.56,releasedGross:100,platformCommission:12.75,providerNetReleased:87.25,depositsAmount:200,depositsCount:3,paymentGatewayFees:2},withdrawals:{PENDING:{count:1,amount:20}},affiliateCommissions:{APPROVED:{count:2,amount:1.5}},series:[{month:'2026-11',deposits:200,releasedGross:100,withdrawalsPaid:10,affiliateCommissions:1.5}]};

describe('financial statement export',()=>{
  it('uses real values with separate financial sections and no dashboard shell',()=>{
    const html=financialReportHtml(data,[],new Date('2026-11-12T10:00:00Z'),'https://local.test/font.ttf');
    const doc=new DOMParser().parseFromString(html,'text/html');
    expect(doc.querySelector('h1')?.textContent).toBe('التقرير المالي للمنصة');
    expect(doc.body.textContent).toContain('1,234.56 USD'); expect(doc.body.textContent).toContain('12.75 USD');
    expect(doc.querySelectorAll('table')).toHaveLength(4); expect(doc.body.textContent).toContain('تكلفة مدفوعات');
    expect(doc.querySelector('nav,button,canvas,app-root,iframe')).toBeNull(); expect(html).not.toContain('supper-admin-overview');
  });
  it('escapes financial-party text and labels recent rows as a partial history',()=>{
    const tx={id:'x',type:'DEPOSIT',amount:123.4,currency:'SAR',status:'COMPLETED',createdAt:'2026-11-12',user:{id:'u',name:'<img src=x onerror=alert(1)>',email:'x@test'}} as AdminTransaction;
    const html=financialReportHtml(data,[tx],new Date(),'https://local.test/font.ttf');
    const doc=new DOMParser().parseFromString(html,'text/html');
    expect(doc.querySelector('img,script')).toBeNull(); expect(doc.body.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(doc.body.textContent).toContain('123.40 SAR'); expect(doc.body.textContent).toContain('ليست كشفًا بجميع المعاملات');
  });
});
