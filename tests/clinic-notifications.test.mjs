import test from 'node:test';import assert from 'node:assert/strict';
import {clinicNotifications} from '../assets/clinic-notification-core.mjs';
import {approvedAgenda} from '../assets/clinic-core.mjs';
const actor={user_id:'teacher-a',role:'teacher',teacher_code:'SOC'};
const row={id:'guest-a',date:'2027-06-28',start:'20:30',end:'21:30',classroom:'X-1',teacher:'Pengampu',teacher_code:'SOC',subjects:['Sosiologi'],approved_subject:'Sosiologi',owner_id:null,request_kind:'guest',status:'approved',revision:2,decided_at:'2027-06-01T08:00Z'};
test('accepted pupil/guest request reaches its assigned teacher and public agenda',()=>{
 const items=clinicNotifications([row],actor);assert.equal(items.length,1);assert.equal(items[0].title,'Ajuan murid/tamu diterima');assert.equal(items[0].subject,'Sosiologi');
 assert.equal(approvedAgenda([row],Date.parse('2027-06-01T00:00Z')).length,1);
 assert.equal(clinicNotifications([row],{...actor,user_id:'teacher-b',teacher_code:'BIO'}).length,0);
});
test('an owner sees acceptance/rejection; pending and unrelated records do not become notifications',()=>{
 const own={...row,id:'own-a',owner_id:actor.user_id,request_kind:'teacher',teacher_code:'BIO'};
 assert.equal(clinicNotifications([own],actor)[0].title,'Ajuan Klinik Anda diterima');
 assert.equal(clinicNotifications([{...own,status:'rejected'}],actor)[0].title,'Ajuan Klinik ditolak');
 assert.equal(clinicNotifications([{...own,status:'pending'},{...own,owner_id:'other'}],actor).length,0);
 assert.equal(clinicNotifications([row],{...actor,role:'member'}).length,0);
 assert.equal(clinicNotifications([row],{role:'guest'}).length,0);
});
test('report revisions keep the read key while a new decision or assignment changes it',()=>{
 const key=clinicNotifications([row],actor)[0].key;
 assert.equal(clinicNotifications([{...row,revision:9,topic:'Laporan diperbarui'}],actor)[0].key,key);
 assert.notEqual(clinicNotifications([{...row,status:'cancelled'}],actor)[0].key,key);
 assert.notEqual(clinicNotifications([{...row,decided_at:'2027-06-02T08:00Z'}],actor)[0].key,key);
});
