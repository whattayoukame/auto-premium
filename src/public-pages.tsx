import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { addDays, addMinutes } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { ArrowRight, ArrowUpRight, CalendarBlank, CalendarCheck, CalendarPlus, Car, CaretLeft, CheckCircle, Clock, MapPin, ShieldCheck, Sparkle, Phone, XCircle, WarningCircle } from '@phosphor-icons/react';
import { Button } from '@astryxdesign/core/Button';
import { api, isLocalTenant, isRemoteStudio } from './api';
import { bookingContactSchemas, bookingInputSchema, minutesText, money, type Booking, type Service } from './domain';
import { hourLabel, localDate, prettyDate } from './slots';
import { useSlug, useStudio } from './studio-context';
import { createUUID } from './uuid';
import { tenantAssetUrl } from './assets';

function SectionTitle({eyebrow,title,detail}:{eyebrow:string;title:string;detail?:string}){return <div className="section-heading reveal"><div><span className="eyebrow"><span className="blue-dot"/> {eyebrow}</span><h2>{title}</h2></div>{detail&&<p>{detail}</p>}</div>;}

export function HomePage(){const s=useStudio(),slug=useSlug();const base=`/s/${slug}`;
  return <>
    <section className="hero"><div className="hero-visual"><img src={tenantAssetUrl(s.hero)} alt="Автомобиль после профессионального детейлинга"/><div className="hero-shadow"/>
      <div className="hero-index">01 <span/> ЭСТЕТИКА ДВИЖЕНИЯ</div>
      <div className="hero-copy"><div className="hero-kicker"><span className="glow-dot"/> {s.eyebrow}</div><h1>{s.tagline}</h1><p>{s.description}</p><div className="hero-small-stats"><span><Sparkle size={16}/> ПРЕМИАЛЬНЫЙ УХОД</span><span><ShieldCheck size={16}/> ПРОФЕССИОНАЛЬНАЯ КОМАНДА</span></div></div>
      <Link to={base+'/booking'} className="hero-liquid"><span className="hero-glass-content">ЗАПИСАТЬСЯ <ArrowUpRight size={25}/></span></Link>
      <span className="hero-corner">DETAILS MATTER. / {new Date().getFullYear()}</span>
    </div></section>
    <div className="ticker"><span>DETAILING</span><i/> <span>PROTECTION</span><i/><span>PERFECTION</span><i/><span>PRECISION</span><i/><span>YOUR CAR. REIMAGINED.</span></div>
    <section className="section container" id="services"><SectionTitle eyebrow="01 / ЧТО МЫ ДЕЛАЕМ" title="Забота в каждой детали" detail="Всё, что нужно вашему автомобилю, в одном месте. Честные цены и безупречный результат."/>
      <div className="services-grid">{s.services.filter(x=>x.enabled).slice(0,4).map((service,i)=><Link to={base+`/booking?service=${service.id}`} key={service.id} className="service-card reveal"><div className="service-card-top"><span>0{i+1}</span><ArrowUpRight size={23}/></div><div><p className="service-category">{service.category}</p><h3>{service.title}</h3><p className="service-description">{service.description}</p></div><div className="service-card-bottom"><span>от <strong>{money(service.price,s.currency)}</strong></span><span>{minutesText(service.durationMinutes)} <Clock size={15}/></span></div></Link>)}</div>
      <Link to={base+'/services'} className="text-link">Все услуги и цены <ArrowRight size={18}/></Link></section>
    <section className="section portfolio-section"><div className="container"><SectionTitle eyebrow="02 / НАШИ РАБОТЫ" title="Говорят сами за себя" detail="Каждый автомобиль — отдельная история. Вот некоторые из наших."/>
      <div className="portfolio-grid">{s.gallery.map((work,i)=><figure key={work.id} className={`portfolio-item portfolio-${i%3} reveal`}><img src={tenantAssetUrl(work.image)} alt={work.caption}/><figcaption><span>0{i+1} / {work.caption}</span><ArrowUpRight size={20}/></figcaption></figure>)}</div></div></section>
    <section className="section container"><SectionTitle eyebrow="03 / ПОЧЕМУ МЫ" title="Ваш автомобиль заслуживает большего"/>
      <div className="benefit-grid">{s.infoCards.map((c,i)=>{const icons=[ShieldCheck,Clock,Sparkle];const Icon=icons[i];return <div className="benefit reveal" key={i}><div className="benefit-icon"><Icon size={29}/></div><span>0{i+1} — ПРЕИМУЩЕСТВО</span><h3>{c.title}</h3><p>{c.text}</p></div>;})}</div>
    </section>
    <section className="section reserve-section" id="reserve"><div className="container reserve-inner"><div className="reserve-copy"><span className="eyebrow"><span className="blue-dot"/> 04 / ОНЛАЙН-ЗАПИСЬ</span><h2>Запись<br/><em>в студию</em></h2><p>Никаких звонков и ожидания. Выберите услугу и удобное время за пару минут.</p><div className="reserve-points"><span><CheckCircle/> Актуальные свободные часы</span><span><CheckCircle/> Подтверждение сразу после записи</span><span><CheckCircle/> Управление записью онлайн</span></div></div>
      <div className="reserve-card"><span className="mini-label">ЗАПИСЬ В СТУДИЮ</span><div className="reserve-card-logo">A<span>.</span></div><h3>Готовы обновить<br/>свой автомобиль?</h3><p>Выберите удобное время прямо сейчас</p><Link to={base+'/booking'} className="btn btn-primary">Выбрать время <ArrowUpRight size={20}/></Link><div className="reserve-card-foot"><CalendarBlank size={17}/> Запись открыта круглосуточно</div></div></div></section>
    <section className="section container location-section"><SectionTitle eyebrow="05 / КОНТАКТЫ" title="Ждём вас в студии"/><div className="location-layout"><div className="location-card"><span className="mini-label">НАШ АДРЕС</span><h3>{s.address}</h3><p>Перед посещением рекомендуем записаться — мы подготовим всё к вашему приезду.</p><a href={`https://maps.google.com/?q=${encodeURIComponent(s.address)}`} target="_blank" rel="noreferrer" className="btn btn-outline">Построить маршрут <ArrowUpRight size={18}/></a><div className="location-details"><p><Phone size={19}/> <a href={`tel:${s.phone.replace(/[^\d+]/g,'')}`}>{s.phone}</a></p><p><Clock size={19}/> Пн–Пт · {s.schedule['1']?.open}–{s.schedule['1']?.close}</p></div></div><div className="location-art"><MapPin size={48} weight="thin"/><span>FIND YOUR<br/>PERFECT FINISH</span><i>{s.name}</i></div></div></section>
  </>;
}

export function ServicesPage(){const s=useStudio(),slug=useSlug();return <div className="container inner-page"><span className="eyebrow"><span className="blue-dot"/> ПРАЙС-ЛИСТ / {s.name}</span><h1>Услуги <em>и цены.</em></h1><p className="page-intro">Выберите услугу, узнайте продолжительность и найдите удобное время.</p><div className="catalog">{s.services.filter(x=>x.enabled).map((x,i)=><div className="catalog-row reveal" key={x.id}><span className="catalog-number">{String(i+1).padStart(2,'0')}</span><div className="catalog-text"><small>{x.category}</small><h2>{x.title}</h2><p>{x.description}</p></div><div className="catalog-side"><strong>{money(x.price,s.currency)}</strong><span><Clock size={16}/>{minutesText(x.durationMinutes)}</span></div><Link to={`/s/${slug}/booking?service=${x.id}`} className="round-arrow" aria-label={`Записаться на ${x.title}`}><ArrowUpRight size={24}/></Link></div>)}</div><div className="note-panel"><Sparkle size={23}/><p>Есть вопросы по услуге? Спросите нашего помощника — он подскажет стоимость и доступное время.</p></div></div>}

export function BookingPage(){const s=useStudio(),slug=useSlug(),navigate=useNavigate(),qc=useQueryClient();const [params]=useSearchParams();
  const [serviceId,setServiceId]=useState(params.get('service')||s.services.find(x=>x.enabled)?.id||'');
  const today=localDate(new Date(),s.timezone);
  const [date,setDate]=useState(today),[time,setTime]=useState('');const [name,setName]=useState(''),[phone,setPhone]=useState(''),[car,setCar]=useState(''),[error,setError]=useState('');
  type ContactField = 'name' | 'phone' | 'car';
  const [submitted,setSubmitted]=useState(false);
  const [touched,setTouched]=useState<Record<ContactField,boolean>>({name:false,phone:false,car:false});
  const fieldErrors: Record<ContactField,string> = {
    name: !name.trim() ? 'Укажите ФИО.' : bookingContactSchemas.customerName.safeParse(name).success ? '' : 'ФИО должно содержать от 2 до 100 символов.',
    phone: !phone.trim() ? 'Укажите номер телефона.' : bookingContactSchemas.phone.safeParse(phone).success ? '' : 'Введите корректный номер телефона (7–15 цифр).',
    car: !car.trim() ? 'Укажите марку и модель автомобиля.' : bookingContactSchemas.car.safeParse(car).success ? '' : 'Укажите марку и модель (от 2 до 100 символов).',
  };
  const showFieldError=(field:ContactField)=>(submitted||touched[field])&&!!fieldErrors[field];
  const touchField=(field:ContactField)=>setTouched(current=>({...current,[field]:true}));
  const submitBooking=(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    setSubmitted(true);
    setError('');
    const invalid=(['name','phone','car'] as const).find(field=>fieldErrors[field]);
    if(invalid){event.currentTarget.querySelector<HTMLInputElement>(`[name="${invalid}"]`)?.focus();return;}
    mutation.mutate();
  };
  const [pendingKey]=useState(createUUID);const selected=s.services.find(x=>x.id===serviceId);
  const days=useMemo(()=>Array.from({length:14},(_,i)=>{const d=addDays(new Date(`${today}T12:00:00Z`),i);return d.toISOString().slice(0,10);}),[today]);
  const avail=useQuery({queryKey:['available',slug,serviceId,date],queryFn:()=>api.availability(slug,serviceId,date),enabled:!!serviceId,refetchInterval:30000});
  const mutation=useMutation({mutationFn:()=>api.reserve(slug,bookingInputSchema.parse({serviceId,startsAt:time,customerName:name,phone,car,idempotencyKey:pendingKey})),onSuccess:b=>{if(isRemoteStudio(slug)) localStorage.setItem(`remote-booking-receipt:${slug}`,JSON.stringify(b));localStorage.setItem(`my-booking:${slug}`,JSON.stringify({id:b.id,token:b.cancellationToken}));qc.invalidateQueries({queryKey:['available',slug]});navigate(`/s/${slug}/my`,{replace:true});},onError:e=>{setError(e.message);if(e.message.includes('Это время только что заняли'))setTime('');qc.invalidateQueries({queryKey:['available',slug]});}});
  const canBook=isLocalTenant(slug)||s.published;
  return <div className="container booking-page inner-page"><Link to={`/s/${slug}/services`} className="back-link"><CaretLeft size={16}/> Назад к услугам</Link><span className="eyebrow"><span className="blue-dot"/> ОНЛАЙН-ЗАПИСЬ / ШАГ 01—03</span><h1>Запись <em>в студию.</em></h1><p className="page-intro">Три простых шага до идеального результата.</p>
    <div className="booking-layout"><div className="booking-main"><section className="booking-step"><div className="step-title"><span>01</span><div><h2>Выберите услугу</h2><p>Что сделаем для вашего автомобиля?</p></div></div><div className="service-options">{s.services.filter(x=>x.enabled).map(service=><button type="button" className={`service-option ${serviceId===service.id?'active':''}`} key={service.id} onClick={()=>{setServiceId(service.id);setTime('');}}><span className="radio-dot"/><span className="service-option-info"><strong>{service.title}</strong><small>{minutesText(service.durationMinutes)}</small></span><b>{money(service.price,s.currency)}</b></button>)}</div></section>
      <section className="booking-step"><div className="step-title"><span>02</span><div><h2>Дата и время</h2><p>Показываем только реальные свободные места</p></div></div><div className="day-strip">{days.map(d=><button type="button" key={d} className={date===d?'selected':''} onClick={()=>{setDate(d);setTime('');}}><span>{formatInTimeZone(new Date(`${d}T12:00:00Z`),'UTC','EEE',{locale:undefined})}</span><strong>{d.slice(8)}</strong><span>{formatInTimeZone(new Date(`${d}T12:00:00Z`),'UTC','MM')}</span></button>)}</div>
        <div className="time-head"><Clock size={18}/> Свободное время <small>часовой пояс {s.timezone}</small></div>
        {avail.isLoading?<p className="muted" role="status">Проверяем свободные боксы…</p>:avail.isError?<p className="form-error">Не удалось проверить доступность. Повторите попытку.</p>:<div className="time-grid">{avail.data?.available.map(t=><button type="button" key={t} className={time===t?'chosen':''} onClick={()=>{setTime(t);}}>{hourLabel(t,s.timezone)}</button>)}{avail.data?.unavailable.map(t=><button type="button" key={t} className="busy" disabled aria-label={`${hourLabel(t,s.timezone)} занято`}>{hourLabel(t,s.timezone)}<small>занято</small></button>)}</div>}
        {!avail.isLoading&&!avail.data?.available.length&&<p className="availability-empty">На эту дату свободных мест нет. Выберите другой день.</p>}
      </section>
      <section className="booking-step"><div className="step-title"><span>03</span><div><h2>Ваши данные</h2><p>Чтобы мы знали, кого ждать</p></div></div>
        <form className="booking-fields" noValidate onSubmit={submitBooking}>
          <label className={showFieldError('name')?'booking-field-invalid':''}>
            <span>ФИО <span aria-hidden="true">*</span></span>
            <input name="name" autoComplete="name" value={name} onChange={e=>setName(e.target.value)} onBlur={()=>touchField('name')} placeholder="Александр" required minLength={2} maxLength={100} aria-invalid={showFieldError('name')} aria-describedby={showFieldError('name')?'booking-name-error':undefined}/>
            {showFieldError('name')&&<span className="booking-field-error" id="booking-name-error"><WarningCircle size={15} aria-hidden="true"/>{fieldErrors.name}</span>}
          </label>
          <label className={showFieldError('phone')?'booking-field-invalid':''}>
            <span>Телефон <span aria-hidden="true">*</span></span>
            <input name="phone" type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} onBlur={()=>touchField('phone')} placeholder="+7 999 123-45-67" required aria-invalid={showFieldError('phone')} aria-describedby={showFieldError('phone')?'booking-phone-error':undefined}/>
            {showFieldError('phone')&&<span className="booking-field-error" id="booking-phone-error"><WarningCircle size={15} aria-hidden="true"/>{fieldErrors.phone}</span>}
          </label>
          <label className={`full ${showFieldError('car')?'booking-field-invalid':''}`}>
            <span>Марка и модель автомобиля <span aria-hidden="true">*</span></span>
            <input name="car" value={car} onChange={e=>setCar(e.target.value)} onBlur={()=>touchField('car')} placeholder="Например, BMW 5 серии" required minLength={2} maxLength={100} aria-invalid={showFieldError('car')} aria-describedby={showFieldError('car')?'booking-car-error':undefined}/>
            {showFieldError('car')&&<span className="booking-field-error" id="booking-car-error"><WarningCircle size={15} aria-hidden="true"/>{fieldErrors.car}</span>}
          </label>
          {error&&<div className="form-error full" role="alert"><WarningCircle size={18}/>{error}</div>}
          <button type="submit" className="btn btn-primary submit-book full" disabled={!canBook||!selected||!time||mutation.isPending}>{mutation.isPending?'Подтверждаем…':canBook?'Подтвердить запись':'Студия ещё не опубликована'} <ArrowRight size={20}/></button>
          <p className="field-note full">Поля со звёздочкой обязательны. {isRemoteStudio(slug)?"Нажимая «Подтвердить», вы сохраняете данные записи в Supabase. Проверьте, что студия подключена к этому кабинету владельца.":"Демо: запись хранится только в вашем браузере и не поступает в компанию."}</p>
        </form>
      </section>
    </div><aside className="booking-summary"><span className="mini-label">ВАША ЗАПИСЬ</span><div className="summary-monogram">A<span>.</span></div><h3>{selected?.title||'Выберите услугу'}</h3><div className="summary-item"><span>Стоимость</span><strong>{selected?`от ${money(selected.price,s.currency)}`:'—'}</strong></div><div className="summary-item"><span>Длительность</span><strong>{selected?minutesText(selected.durationMinutes):'—'}</strong></div><div className="summary-item"><span>Дата и время</span><strong>{time?prettyDate(time,s.timezone):'Не выбрано'}</strong></div><div className="summary-divider"/><p><ShieldCheck size={18}/> Никакой предоплаты онлайн</p><p><CheckCircle size={18}/> Подтверждение сразу после записи</p></aside></div></div>;
}

function calendarFile(booking:Booking,s:{name:string;address:string;timezone:string}, durationMinutes:number){
  const utc=(d:Date)=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const esc=(v:string)=>v.replace(/\\/g,'\\\\').replace(/,/g,'\\,').replace(/;/g,'\\;').replace(/\n/g,'\\n');
  const ics=`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//ATELIER//Booking//RU\r\nBEGIN:VEVENT\r\nUID:${booking.id}@atelier-booking\r\nDTSTAMP:${utc(new Date())}\r\nDTSTART:${utc(new Date(booking.startsAt))}\r\nDTEND:${utc(addMinutes(new Date(booking.startsAt),durationMinutes))}\r\nSUMMARY:${esc(booking.serviceTitle+' · '+s.name)}\r\nLOCATION:${esc(s.address)}\r\nBEGIN:VALARM\r\nTRIGGER:-P1D\r\nACTION:DISPLAY\r\nDESCRIPTION:Запись завтра\r\nEND:VALARM\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
  const u=URL.createObjectURL(new Blob([ics],{type:'text/calendar;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download='zapis-v-studiyu.ics';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);
}
export function MyBookingPage(){const s=useStudio(),slug=useSlug(),qc=useQueryClient();
  const saved=useMemo(()=>{try{return JSON.parse(localStorage.getItem(`my-booking:${slug}`)||'null') as {id:string;token:string}|null;}catch{return null;}},[slug]);
  const query=useQuery({queryKey:['own',slug,saved?.id],queryFn:()=>api.ownBooking(slug,saved!.id,saved!.token),enabled:!!saved});
  const [error,setError]=useState('');const cancel=useMutation({mutationFn:()=>api.cancel(slug,saved!.id,saved!.token),onSuccess:()=>{qc.invalidateQueries({queryKey:['own',slug]});qc.invalidateQueries({queryKey:['available',slug]});},onError:e=>setError(e.message)});
  const b=query.data;const service=s.services.find(x=>x.id===b?.serviceId);
  return <div className="container inner-page my-page"><span className="eyebrow"><span className="blue-dot"/> ВАШ ЛИЧНЫЙ КАБИНЕТ</span><h1>Моя <em>запись.</em></h1>
    {!saved?<div className="empty-state"><CalendarBlank size={53}/><h2>Пока нет активной записи</h2><p>После бронирования здесь появятся все детали. Регистрация не нужна.</p><Link to={`/s/${slug}/booking`} className="btn btn-primary">Записаться <ArrowRight size={19}/></Link></div>:query.isLoading?<p className="muted">Загружаем вашу запись…</p>:query.isError?<div className="empty-state"><WarningCircle size={50}/><h2>Запись не найдена</h2><p>Возможно, ссылка устарела или запись была удалена.</p></div>:b&&<div className="appointment-card"><div className="appointment-top"><div className="appointment-icon"><CalendarCheck size={31}/></div><div><span className="mini-label">ПОДТВЕРЖДЕНИЕ ЗАПИСИ</span><h2>{b.status==='cancelled'?'Запись отменена':'Вы записаны!'}</h2></div><span className={`status-tag ${b.status}`}>{({reserved:'Ожидаем',arrived:'Принята',ready:'Готова',completed:'Завершена',cancelled:'Отменена'} as const)[b.status]}</span></div>
      <div className="appointment-details"><div><span>УСЛУГА</span><strong>{b.serviceTitle}</strong></div><div><span>ДАТА И ВРЕМЯ</span><strong>{prettyDate(b.startsAt,s.timezone)}</strong></div><div><span>АВТОМОБИЛЬ</span><strong>{b.car}</strong></div><div><span>ИМЯ</span><strong>{b.customerName}</strong></div><div><span>АДРЕС</span><strong>{s.address}</strong></div><div><span>СТОИМОСТЬ ОТ</span><strong>{service?money(service.price,s.currency):'Уточняется'}</strong></div></div>
      {error&&<p className="form-error">{error}</p>}
      {b.status!=='cancelled'&&<div className="appointment-actions"><button className="btn btn-primary" onClick={()=>calendarFile(b,s,service?.durationMinutes||60)}><CalendarPlus size={20}/> Добавить в календарь <ArrowRight size={19}/></button>{!isRemoteStudio(slug)&&b.status==='reserved'&&<button className="btn btn-outline" disabled={cancel.isPending} onClick={()=>{if(confirm('Отменить запись?'))cancel.mutate();}}><XCircle size={19}/> Отменить запись</button>}</div>}
      <p className="note"><Clock size={18}/> Напоминание за 24 часа до визита включено в скачиваемом календарном событии. {isRemoteStudio(slug)?'На этой странице сохранено подтверждение. Актуальный статус и отмену уточняйте у студии.':`Самостоятельная отмена возможна за ${s.cancellationHours} ч до записи.`}</p>
    </div>}
  </div>;
}
