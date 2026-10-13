import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, CalendarBlank, CheckCircle, Clock, EnvelopeSimple, MapPin, Phone, ShieldCheck, Star, Wrench } from '@phosphor-icons/react';
import { money } from './domain';
import { tenantAssetUrl } from './assets';
import { useSlug, useStudio } from './studio-context';
import { isRemoteStudio } from './api';

const GIS = 'https://2gis.ru/novosibirsk/firm/141265770954081';
const GIS_PRICES = `${GIS}/tab/prices`;
const GIS_REVIEWS = `${GIS}/tab/reviews`;
const GIS_GALLERY = 'https://2gis.ru/novosibirsk/gallery/firm/141265770954081';
const phoneParts = [
  { number: '+7 (383) 239-22-10', label: 'Автосервис' },
  { number: '+7 (383) 310-58-08', label: 'Магазин запчастей' },
];
const reviews = [
  { name: 'Николай Веричев', context: '26 апреля 2026', text: 'Уже много лет обслуживаю автомобили в Авто Премиум! Профессионалы своего дела: всегда точная диагностика, качественный ремонт и адекватные цены. Однозначно рекомендую!' },
  { name: 'Evgen Kot', context: '6 января 2025', text: 'Дружелюбный и профессиональный коллектив, всё объяснили показали, допускают в зону ремонта! Парни молодцы, спасибо за помощь, будем и дальше обслуживать LX у Вас!' },
  { name: 'Лия Жиргалова', context: '21 января 2023', text: 'Очень классный автосервис, я из другого города, нашла по рекомендациям. Не открывалась водительская дверь на Инфинити, все сделали, быстро, недорого. Спасибо!! Только сюда теперь❤️' },
];

function Label({index,children}:{index:string;children:string}) {return <div className="ap-section-label"><span>{index}</span>{children}</div>;}

export function AutoPremiumHomePage() {
  const s=useStudio(), slug=useSlug(),base=`/s/${slug}`,connected=isRemoteStudio(slug);
  return <div className="ap-site">
    <section className="ap-hero">
      <div className="ap-hero-image" style={{backgroundImage:`linear-gradient(90deg,rgba(8,8,9,.94) 0%,rgba(8,8,9,.63) 52%,rgba(8,8,9,.20) 100%), url('${tenantAssetUrl(s.hero)}')`}} aria-hidden="true"/>
      <div className="ap-hero-noise" aria-hidden="true"/>
      <div className="container ap-hero-content">
        <div className="ap-hero-top"><span>НОВОСИБИРСК / ФРУНЗЕ, 104Б</span><span>АВТОСЕРВИС ДЛЯ БЛАГОРОДНЫХ МАРОК</span></div>
        <div className="ap-hero-body"><div className="ap-hero-copy">
          <span className="ap-overline"><span className="ap-live"/> РЕМОНТ · ДИАГНОСТИКА · ОБСЛУЖИВАНИЕ</span>
          <h1>АВТО<span>ПРЕМИУМ</span><small>Техническая точность.<br/>Человеческий подход.</small></h1>
          <p>Специализированный автосервис Infiniti, Nissan, Lexus, Toyota и Geely. От диагностики до сложного ремонта — с подбором запчастей под ваш автомобиль.</p>
          <div className="ap-hero-actions"><Link className="ap-button-light" to={`${base}/booking`}>{connected ? "Записаться онлайн" : "Попробовать онлайн-запись"} <ArrowUpRight size={21}/></Link><a className="ap-button-ghost" href="tel:+73832392210">Позвонить в сервис <Phone size={18}/></a></div>
          <span className="ap-hero-hint">{connected ? "Сайт-концепт · Запись сохраняется в Supabase" : "Сайт-концепт · Онлайн-запись работает в деморежиме"}</span>
        </div></div>
        <div className="ap-hero-bottom"><a href={GIS_REVIEWS} target="_blank" rel="noreferrer"><Star weight="fill" size={17}/><strong>5,0 / 5</strong><span>307 оценок в 2ГИС <ArrowUpRight size={13}/></span></a><span>INFINITI <b>·</b> NISSAN <b>·</b> LEXUS <b>·</b> TOYOTA <b>·</b> GEELY</span></div>
      </div>
    </section>

    <div className="ap-trust-bar"><div className="container"><span>СПЕЦИАЛИЗАЦИЯ НА ПРЕМИАЛЬНЫХ МАРКАХ</span><span><CheckCircle size={17}/> Запчасти в наличии и под заказ</span><span><Clock size={17}/> Работаем ежедневно</span><a href={GIS} target="_blank" rel="noreferrer">Проверить в 2ГИС <ArrowUpRight size={16}/></a></div></div>

    <section className="section container ap-services" id="services"><Label index="01">НАПРАВЛЕНИЯ РАБОТ</Label><div className="ap-heading-row"><h2>Знаем ваш<br/><em>автомобиль.</em></h2><p>Техническое обслуживание и ремонт с упором на японские премиальные марки. Ниже — реальные позиции из опубликованного каталога 2ГИС.</p></div>
      <div className="ap-service-grid">{[...s.services.slice(0,5),s.services[8]].filter((x):x is typeof s.services[number]=>!!x&&x.enabled).map((x,i)=><Link key={x.id} className="ap-service" to={`${base}/booking?service=${x.id}`}><span className="ap-service-count">0{i+1}<ArrowUpRight size={23}/></span><div><small>{x.category}</small><h3>{x.title}</h3><p>{x.description}</p></div><span className="ap-service-price">ОТ <strong>{money(x.price,s.currency)}</strong><ArrowRight size={20}/></span></Link>)}</div>
      <div className="ap-services-bottom"><p>{connected ? "Стоимость услуг загружена из базы записи. Итоговую стоимость и объём работ уточняйте в сервисе." : "Цены взяты из опубликованного прайса на 6 июля 2026 года. Итоговую стоимость и объём работ подтверждает сервис."}</p><Link to={`${base}/services`} className="ap-line-link">Все услуги и цены <ArrowUpRight size={18}/></Link></div>
    </section>

    <section className="ap-expertise"><div className="ap-expertise-image"><img src={tenantAssetUrl('/tenants/autopremium/images/trust-awards-2gis.jpg')} alt="Награды Авто Премиум на входе в автосервис"/></div><div className="ap-expertise-content"><Label index="02">О СЕРВИСЕ</Label><h2>СЕРВИС,<br/>КОТОРОМУ<br/><em>ДОВЕРЯЮТ.</em></h2><p>Авто Премиум занимается ремонтом, диагностикой и обслуживанием автомобилей. Для Infiniti, Nissan, Lexus и Toyota доступны профильные работы, помощь с подбором оригинальных деталей и аналогов.</p><div className="ap-expertise-list"><span><Wrench size={22}/> Ремонт двигателя, подвески и электрики</span><span><ShieldCheck size={22}/> Диагностика и обслуживание</span><span><CheckCircle size={22}/> Продажа и заказ автозапчастей</span></div><a className="ap-line-link" href={GIS} target="_blank" rel="noreferrer">Подробнее о компании в 2ГИС <ArrowUpRight size={18}/></a></div></section>

    <section className="section container ap-gallery" id="gallery"><Label index="03">ФОТОГАЛЕРЕЯ</Label><div className="ap-heading-row"><h2>Из бокса —<br/><em>в дорогу.</em></h2></div><div className="ap-gallery-grid">{s.gallery.map((work,i)=><a key={work.id} className={`ap-gallery-tile ap-gallery-${i}`} href={i===0?'https://yandex.com/maps/org/avto_premium/92181715366/':GIS_GALLERY} target="_blank" rel="noreferrer"><img src={tenantAssetUrl(work.image)} alt={work.caption}/><ArrowUpRight className="ap-gallery-open" size={21} aria-hidden="true"/></a>)}</div><a className="ap-line-link" href={GIS_GALLERY} target="_blank" rel="noreferrer">Открыть все фото компании в 2ГИС <ArrowUpRight size={18}/></a></section>

    <section className="ap-reviews" id="reviews"><div className="container"><Label index="04">ОТЗЫВЫ КЛИЕНТОВ</Label><div className="ap-heading-row"><h2>Репутация<br/><em>говорит сама.</em></h2><div className="ap-rating"><strong>5,0<span>/5</span></strong><div>★★★★★</div><a href={GIS_REVIEWS} target="_blank" rel="noreferrer">307 оценок · 2ГИС ↗</a></div></div><div className="ap-review-grid">{reviews.map((r,i)=><article className="ap-review" key={r.name}><span className="ap-review-index">0{i+1} / ОТЗЫВ С 2ГИС <span>★★★★★</span></span><p>{r.text}</p><div><strong>{r.name}</strong><small>{r.context}</small></div></article>)}</div><a className="ap-line-link" href={GIS_REVIEWS} target="_blank" rel="noreferrer">Читать все отзывы <ArrowUpRight size={18}/></a></div></section>

    <section className="section container ap-appointment"><div className="ap-appointment-panel"><div><Label index="05">ЗАПИСЬ В СЕРВИС</Label><h2>ПРИШЛО ВРЕМЯ<br/><em>ЗАНЯТЬСЯ АВТО.</em></h2><p>{connected ? "Выберите услугу, дату и свободное время. Заявка сохраняется в Supabase и будет доступна владельцу студии." : "Посмотрите, как может работать запись онлайн: выбор услуги, даты и времени, данные автомобиля, подтверждение и отмена. Пока это интерактивный прототип — для настоящей записи позвоните в сервис."}</p><div className="ap-appointment-actions"><Link className="ap-button-light" to={`${base}/booking`}>{connected ? "Записаться онлайн" : "Попробовать демо-запись"} <CalendarBlank size={20}/></Link><a className="ap-button-ghost" href="tel:+73832392210">Записаться по телефону <Phone size={17}/></a></div></div><div className="ap-appointment-icon"><img src={tenantAssetUrl(s.logo)} alt="Авто Премиум"/><span>PRECISION<br/>IN EVERY<br/>DETAIL.</span></div></div></section>

    <section className="section container ap-contacts" id="contacts"><Label index="06">КОНТАКТЫ И МАРШРУТ</Label><div className="ap-heading-row"><h2>Заезжайте.<br/><em>Мы рядом.</em></h2><Link className="ap-button-light ap-contact-booking" to={`${base}/booking`}>{connected ? "Записаться онлайн" : "Записаться (демо)"} <CalendarBlank size={20}/></Link></div><div className="ap-contact-grid"><div className="ap-contact-data"><div><span>АДРЕС</span><strong>{s.address}</strong><a href={GIS} target="_blank" rel="noreferrer">Построить маршрут в 2ГИС <ArrowUpRight size={17}/></a></div><div><span>ТЕЛЕФОНЫ</span>{phoneParts.map(p=><a className="ap-phone" href={`tel:${p.number.replace(/[^\d+]/g,'')}`} key={p.number}>{p.number}<small>{p.label}</small></a>)}</div><div><span>ПОЧТА</span><a className="ap-phone" href="mailto:autopremium54@gmail.com">autopremium54@gmail.com</a></div><div><span>ВРЕМЯ РАБОТЫ</span><strong>Пн–Пт: 09:00–20:00<br/>Сб–Вс: 09:00–18:00</strong></div><div className="ap-contact-icons"><Phone size={18}/><EnvelopeSimple size={18}/><MapPin size={18}/></div></div><div className="ap-map"><iframe title="Местоположение Авто Премиум на карте Новосибирска" loading="lazy" referrerPolicy="no-referrer" src="https://www.openstreetmap.org/export/embed.html?bbox=82.932%2C55.034%2C82.945%2C55.041&amp;layer=mapnik&amp;marker=55.037261%2C82.938694"/><a href={GIS} target="_blank" rel="noreferrer"><MapPin size={18}/> Открыть точный маршрут в 2ГИС <ArrowUpRight size={17}/></a></div></div></section>
    <div className="ap-copyright-source container">Информация о компании: <a href={GIS} target="_blank" rel="noreferrer">2ГИС</a>. Демо-концепт, неофициальный сайт. Изображения и фирменный знак требуют согласования с правообладателями перед публикацией.</div>
  </div>;
}
