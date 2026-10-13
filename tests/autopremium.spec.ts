import { expect, test } from '@playwright/test';

const pagePaths = ['/', '/services', '/booking', '/my'];

for (const width of [320, 390, 760, 1440]) {
  test.describe(`Auto Premium service number palette ${width}px`, () => {
    test.use({ viewport: { width, height: 900 }, isMobile: width <= 760, hasTouch: width <= 760 });

    test('uses warm milk-colored catalog numbers and opens the selected service', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('/s/autopremium/services');
      const rows = page.locator('.catalog-row');
      await expect(rows).toHaveCount(12);
      const numbers = page.locator('.catalog-number');
      for (let i = 0; i < 3; i++) {
        await expect(numbers.nth(i)).toHaveText(String(i + 1).padStart(2, '0'));
      }
      const colors = await numbers.evaluateAll(elements =>
        elements.map(element => getComputedStyle(element).color)
      );
      expect(colors).toEqual(Array(12).fill('rgb(232, 214, 189)'));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
      await rows.nth(2).locator('.round-arrow').click();
      await expect(page).toHaveURL(/\/s\/autopremium\/booking\?service=/);
      await expect(page.locator('.service-option.active')).toContainText('Обслуживание Nissan');
      expect(errors).toEqual([]);
    });
  });
}

for (const width of [390, 1440]) {
  test.describe(`ATELIER catalog number isolation ${width}px`, () => {
    test.use({ viewport: { width, height: 900 }, isMobile: width <= 760, hasTouch: width <= 760 });

    test('keeps the original catalog number color', async ({ page }) => {
      await page.goto('/s/atelier/services');
      await expect(page.locator('.catalog-number').first()).toBeVisible();
      expect(await page.locator('.catalog-number').first().evaluate(el => getComputedStyle(el).color))
        .toBe('rgb(105, 123, 144)');
    });
  });
}

for (const width of [320, 390, 760, 1440]) {
  test.describe(`Auto Premium contact booking CTA ${width}px`, () => {
    test.use({ viewport: { width, height: 900 }, isMobile: width <= 760, hasTouch: width <= 760 });

    test('replaces the old visit note with a working booking link', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('/s/autopremium/');
      const contacts = page.locator('.ap-contacts');
      await expect(contacts.getByRole('heading', { name: 'Заезжайте. Мы рядом.' })).toBeVisible();
      await expect(contacts.getByText('Перед визитом рекомендуем')).toHaveCount(0);
      const cta = contacts.getByRole('link', { name: 'Записаться (демо)' });
      await expect(cta).toHaveAttribute('href', '/s/autopremium/booking');
      await cta.scrollIntoViewIfNeeded();
      await expect(cta).toBeVisible();
      expect(await cta.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return top === element || element.contains(top);
      }), 'Contact CTA must accept clicks/taps').toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
      await cta.click();
      await expect(page).toHaveURL(/\/s\/autopremium\/booking$/);
      await expect(page.locator('.service-option').first()).toBeVisible();
      expect(errors).toEqual([]);
    });
  });
}

for (const width of [901, 1024, 1150, 1151, 1440]) {
  test.describe(`Auto Premium appointment emblem centering ${width}px`, () => {
    test.use({ viewport: { width, height: 900 }, isMobile: false, hasTouch: false });

    test('centers the emblem and caption between the divider and the outer right edge', async ({ page }) => {
      const runtimeErrors: string[] = [];
      page.on('pageerror', error => runtimeErrors.push(error.message));
      await page.goto('/s/autopremium/');
      const alignment = await page.locator('.ap-appointment-icon').evaluate(icon => {
        const panel = icon.parentElement!;
        const iconRect = icon.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const iconStyle = getComputedStyle(icon);
        const left = iconRect.left + parseFloat(iconStyle.borderLeftWidth);
        const right = panelRect.right;
        const middle = (left + right) / 2;
        const centerOf = (element: Element) => {
          const rect = element.getBoundingClientRect();
          return (rect.left + rect.right) / 2;
        };
        const image = icon.querySelector('img')!;
        return {
          imageOffset: centerOf(image) - middle,
          captionOffset: centerOf(icon.querySelector('span')!) - middle,
          imageLoaded: image.complete && image.naturalWidth === 330,
          iconVisible: iconRect.width > 0,
          pageOverflow: document.documentElement.scrollWidth > innerWidth + 2,
        };
      });
      expect(alignment.iconVisible).toBe(true);
      expect(alignment.imageLoaded).toBe(true);
      expect(Math.abs(alignment.imageOffset)).toBeLessThan(1);
      expect(Math.abs(alignment.captionOffset)).toBeLessThan(1);
      expect(alignment.pageOverflow).toBe(false);
      expect(runtimeErrors).toEqual([]);
    });
  });
}

for (const width of [390, 1440]) {
  test.describe(`Auto Premium verbatim reviews ${width}px`, () => {
    test.use({ viewport: { width, height: 900 }, isMobile: width <= 760, hasTouch: width <= 760 });

    test('shows three complete 2GIS reviews with real authors and no explanatory note', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('/s/autopremium/');
      const cards = page.locator('.ap-review');
      const expected = [
        ['Николай Веричев', '26 апреля 2026', 'Уже много лет обслуживаю автомобили в Авто Премиум! Профессионалы своего дела: всегда точная диагностика, качественный ремонт и адекватные цены. Однозначно рекомендую!'],
        ['Evgen Kot', '6 января 2025', 'Дружелюбный и профессиональный коллектив, всё объяснили показали, допускают в зону ремонта! Парни молодцы, спасибо за помощь, будем и дальше обслуживать LX у Вас!'],
        ['Лия Жиргалова', '21 января 2023', 'Очень классный автосервис, я из другого города, нашла по рекомендациям. Не открывалась водительская дверь на Инфинити, все сделали, быстро, недорого. Спасибо!! Только сюда теперь❤️'],
      ];
      await expect(cards).toHaveCount(3);
      for (let i = 0; i < expected.length; i++) {
        await expect(cards.nth(i).locator('p')).toHaveText(expected[i][2]);
        await expect(cards.nth(i).locator('strong')).toHaveText(expected[i][0]);
        await expect(cards.nth(i).locator('small')).toHaveText(expected[i][1]);
      }
      await expect(page.locator('.ap-reviews-note')).toHaveCount(0);
      await expect(page.getByText('Краткие пересказы опубликованных отзывов')).toHaveCount(0);
      await expect(page.locator('.ap-reviews .ap-line-link')).toHaveAttribute('href', /2gis\.ru.*\/tab\/reviews/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
      expect(errors).toEqual([]);
    });
  });
}

for (const width of [390, 1440]) {
  test.describe(`Auto Premium photos without captions ${width}px`, () => {
    test.use({ viewport: { width, height: 900 }, isMobile: width <= 760, hasTouch: width <= 760 });

    test('keeps gallery photos and accessible links without source overlays or explanatory prose', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('/s/autopremium/');
      await expect(page.locator('.ap-photo-note, .ap-expertise-image > span, .ap-gallery-tile > span, .ap-gallery .ap-heading-row p')).toHaveCount(0);
      await expect(page.getByText('ФОТО КОМПАНИИ · ИСТОЧНИК: КАРТОЧКА ЯНДЕКС')).toHaveCount(0);
      await expect(page.getByText(/Один снимок взят из открытой карточки/)).toHaveCount(0);
      await expect(page.locator('.ap-gallery-tile')).toHaveCount(3);
      const expertiseImage = page.locator('.ap-expertise-image img');
      await expect(expertiseImage).toBeVisible();
      await expect(expertiseImage).toHaveAttribute('src', /\/tenants\/autopremium\/images\/trust-awards-2gis\.jpg$/);
      await expect(expertiseImage).toHaveAttribute('alt', /Награды Авто Премиум/);
      expect(await expertiseImage.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      await expect(page.locator('.ap-gallery-tile').first().locator('img')).toHaveAttribute('src', /\/tenants\/autopremium\/images\/workshop-real\.jpg$/);
      const galleryImages = await page.locator('.ap-gallery-tile img').evaluateAll((images: HTMLImageElement[]) => images.map(img => img.src));
      expect(galleryImages).not.toContain(new URL((await expertiseImage.getAttribute('src'))!, page.url()).href);
      for (const tile of await page.locator('.ap-gallery-tile').all()) {
        const image = tile.locator('img');
        await expect(image).toBeVisible();
        expect(await image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
        await expect(image).toHaveAttribute('alt', /^(?!.*(?:иллюстрация|источник)).+/i);
        await expect(tile).toHaveAttribute('href', /^https:\/\//);
        await expect(tile.locator('.ap-gallery-open')).toHaveCount(1);
      }
      await expect(page.getByRole('link', { name: /Открыть все фото компании в 2ГИС/ })).toHaveAttribute('href', /2gis\.ru/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
      expect(errors).toEqual([]);
    });
  });
}

for (const width of [390, 1440]) {
  test.describe(`Auto Premium original emblem ${width}px`, () => {
    test.use({ viewport: { width, height: 900 }, isMobile: width <= 760, hasTouch: width <= 760 });

    test('header, footer and booking CTA display the original shield without a tile', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('/s/autopremium/');
      const marks = page.locator('header .ap-nav-mark, footer .ap-nav-mark, .ap-appointment-icon img');
      await expect(marks).toHaveCount(3);
      for (const mark of await marks.all()) {
        await expect(mark).toHaveAttribute('src', /\/tenants\/autopremium\/emblem-light\.png$/);
        expect(await mark.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 330 && img.naturalHeight === 396)).toBe(true);
      }
      const headerMark = page.locator('header .ap-nav-mark');
      const geometry = await headerMark.evaluate((img: HTMLImageElement) => {
        const rect = img.getBoundingClientRect();
        const header = img.closest('header')!.getBoundingClientRect();
        const brand = img.closest('a')!.getBoundingClientRect();
        const style = getComputedStyle(img);
        return {
          withinHeader: rect.top >= header.top && rect.bottom <= header.bottom,
          withinBrand: rect.left >= brand.left && rect.right <= brand.right,
          shape: rect.width === rect.height && rect.width >= 40,
          noTile: style.backgroundColor === 'rgba(0, 0, 0, 0)' && style.borderTopWidth === '0px' && style.boxShadow === 'none',
        };
      });
      expect(geometry).toEqual({ withinHeader: true, withinBrand: true, shape: true, noTile: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
      expect(errors).toEqual([]);
    });
  });
}

for (const width of [390, 1440]) {
  test.describe(`Auto Premium hero without decorative seal ${width}px`, () => {
    test.use({ viewport: { width, height: 900 }, isMobile: width <= 760, hasTouch: width <= 760 });

    test('keeps the hero photograph, heading and booking CTA while removing the redundant image', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('/s/autopremium/');
      await expect(page.locator('.ap-hero-seal')).toHaveCount(0);
      await expect(page.getByText('ОРИГИНАЛЬНАЯ ЭМБЛЕМА')).toHaveCount(0);
      await expect(page.locator('.ap-hero h1')).toBeVisible();
      await expect(page.locator('.ap-hero-actions .ap-button-light')).toBeVisible();
      const background = await page.locator('.ap-hero-image').evaluate(element => getComputedStyle(element).backgroundImage);
      expect(background).toContain('/tenants/autopremium/');
      expect(background).not.toBe('none');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
      expect(errors).toEqual([]);
    });
  });
}

for (const width of [320, 390, 760, 800, 1024, 1440]) {
  test.describe(`Auto Premium responsive ${width}px`, () => {
    test.use({ viewport: { width, height: 900 }, isMobile: width <= 760, hasTouch: width <= 760 });

    test('stylesheet, images, navigation, and pages fit the viewport', async ({ page }) => {
      const runtimeErrors: string[] = [];
      page.on('pageerror', error => runtimeErrors.push(error.message));
      for (const route of pagePaths) {
        await page.goto(`/s/autopremium${route}`);
        await expect(page.locator('.autopremium')).toBeVisible();
        const layout = await page.evaluate(() => {
          const site = document.querySelector('.ap-site');
          const visible = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)]
            .filter(element => {
              const r = element.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && getComputedStyle(element).visibility !== 'hidden';
            });
          const clipped = visible('.ap-hero h1, .ap-appointment h2, .ap-service h3, .booking-step h2')
            .filter(element => element.scrollWidth > element.clientWidth + 2)
            .map(element => ({ text: element.textContent?.slice(0, 60), overflow: element.scrollWidth - element.clientWidth }));
          const main = document.querySelector('.booking-main')?.getBoundingClientRect();
          const side = document.querySelector('.booking-summary')?.getBoundingClientRect();
          const overlap = main && side && main.right > side.left + 2 && side.right > main.left + 2 &&
            main.bottom > side.top + 2 && side.bottom > main.top + 2;
          return {
            viewport: window.innerWidth,
            documentWidth: document.documentElement.scrollWidth,
            theme: site ? getComputedStyle(site).backgroundColor : null,
            clipped,
            overlap: !!overlap,
            brokenImages: [...document.querySelectorAll<HTMLImageElement>('img')]
              .filter(img => img.complete && img.naturalWidth === 0)
              .map(img => img.getAttribute('src')),
          };
        });
        expect(layout.documentWidth, `${route}: horizontal overflow`).toBeLessThanOrEqual(layout.viewport + 2);
        expect(layout.clipped, `${route}: clipped headings`).toEqual([]);
        expect(layout.overlap, `${route}: booking summary overlap`).toBe(false);
        expect(layout.brokenImages, `${route}: broken image assets`).toEqual([]);
        if (route === '/') expect(layout.theme, 'Auto Premium stylesheet applied').toBe('rgb(242, 240, 233)');
      }
      if (width <= 760) {
        const nav = page.getByRole('navigation', { name: 'Основная навигация' });
        await expect(nav).toBeVisible();
        for (const link of await nav.locator('a').all()) {
          expect(await link.evaluate(element => {
            const r = element.getBoundingClientRect();
            const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return top === element || element.contains(top);
          }), 'Mobile nav link must accept taps').toBe(true);
        }
      }
      expect(runtimeErrors).toEqual([]);
    });
  });
}

for (const width of [390, 1440]) {
  test.describe(`Auto Premium booking ${width}px`, () => {
    test.use({ viewport: { width, height: 900 }, isMobile: width <= 760, hasTouch: width <= 760 });

    test('service, date, time, confirmation and cancellation', async ({ page }) => {
      const runtimeErrors: string[] = [];
      page.on('pageerror', error => runtimeErrors.push(error.message));
      await page.goto('/s/autopremium/');
      await page.locator('.ap-appointment .ap-button-light').click();
      await expect(page).toHaveURL(/\/s\/autopremium\/booking$/);

      await page.locator('.service-option').nth(1).click();
      await expect(page.locator('.service-option.active')).toContainText('Ремонт Lexus');
      const availableSlots = page.locator('.time-grid button:not(.busy):not([disabled])');
      let foundDate = false;
      for (let day = 2; day < 14; day++) {
        await page.locator('.day-strip button').nth(day).click();
        await expect(page.locator('.booking-step').nth(1).locator('.time-grid')).toBeAttached();
        if (await availableSlots.count() > 0) { foundDate = true; break; }
      }
      expect(foundDate, 'Expected a bookable slot in the next 14 days').toBe(true);
      await availableSlots.first().click();
      await page.getByPlaceholder('Александр').fill('Тестовый Клиент');
      await page.getByPlaceholder('+7 999 123-45-67').fill('+7 999 123-45-67');
      await page.getByPlaceholder('Например, BMW 5 серии').fill('Lexus RX');
      await expect(page.getByRole('button', { name: /Подтвердить запись/ })).toBeEnabled();
      await page.getByRole('button', { name: /Подтвердить запись/ }).click();
      await expect(page).toHaveURL(/\/s\/autopremium\/my$/);
      await expect(page.getByText('Вы записаны!')).toBeVisible();
      await expect(page.getByText('Ремонт Lexus')).toBeVisible();
      await expect(page.getByText('Тестовый Клиент')).toBeVisible();

      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: /Отменить запись/ }).click();
      await expect(page.getByText('Запись отменена')).toBeVisible();
      if (process.env.TEST_BASE_URL) {
        expect(await page.evaluate(() => window.isSecureContext)).toBe(false);
      }
      expect(runtimeErrors).toEqual([]);
    });
  });
}

for (const width of [390, 1440]) {
  test.describe(`Auto Premium owner console ${width}px`, () => {
    test.use({ viewport: { width, height: 900 }, isMobile: width <= 760, hasTouch: width <= 760 });

    test('coffee theme on login, overview, bookings, settings, gallery and assistant', async ({ page }) => {
      const runtimeErrors: string[] = [];
      page.on('pageerror', error => runtimeErrors.push(error.message));
      const background = (selector: string) => page.locator(selector).first()
        .evaluate(element => getComputedStyle(element).backgroundColor);
      const checkWidth = async () => {
        const sizes = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
        expect(sizes.document, 'owner console must fit the viewport').toBeLessThanOrEqual(sizes.viewport + 2);
      };

      await page.goto('/s/autopremium/admin/login');
      await expect(page.getByRole('heading', { name: 'С возвращением.' })).toBeVisible();
      expect(await background('.login-card')).toBe('rgb(39, 35, 29)');
      expect(await background('.demo-login-note')).toBe('rgb(69, 52, 35)');
      await checkWidth();
      await page.getByRole('button', { name: /Открыть демо-кабинет/ }).click();
      await expect(page.locator('.owner-shell')).toBeVisible();
      await expect(page.locator('.owner-sidebar-title, .owner-menu-label')).toHaveCount(0);
      await expect(page.getByRole('navigation', { name: 'Разделы управления' }).locator('button')).toHaveCount(5);
      const menuTop = await page.locator('.owner-sidebar').evaluate(sidebar => {
        const firstButton = sidebar.querySelector('nav button')!;
        return firstButton.getBoundingClientRect().top - sidebar.getBoundingClientRect().top;
      });
      expect(menuTop, 'the menu should start close to the sidebar top').toBeLessThan(width <= 760 ? 36 : 55);
      expect(await background('.owner-sidebar')).toBe('rgb(32, 28, 23)');
      expect(await background('.owner-callout')).toBe('rgb(59, 46, 33)');
      await checkWidth();

      const tab = (label: string) => page.locator('.owner-sidebar nav button').filter({ hasText: label });
      await tab('Записи').click();
      await expect(page.getByRole('heading', { name: 'Записи.' })).toBeVisible();
      await page.getByRole('button', { name: '7 дней' }).click();
      expect(await background('.tabs button.active')).toBe('rgb(85, 64, 42)');
      await checkWidth();

      await tab('Услуги и боксы').click();
      await expect(page.getByRole('heading', { name: 'Услуги и боксы.' })).toBeVisible();
      expect(await background('.service-editor input')).toBe('rgb(27, 25, 21)');
      await checkWidth();

      await tab('Настройки').click();
      await expect(page.getByRole('heading', { name: 'Настройки.' })).toBeVisible();
      expect(await background('.settings-panel input')).toBe('rgb(27, 25, 21)');
      expect(await background('.file-button')).toBe('rgb(69, 51, 33)');
      await checkWidth();

      await tab('Фотографии работ').click();
      await expect(page.getByRole('heading', { name: 'Фотографии работ.' })).toBeVisible();
      expect(await background('.file-button')).toBe('rgb(69, 51, 33)');
      await checkWidth();

      await page.getByRole('button', { name: /Спросить помощника/ }).click();
      await expect(page.locator('.chat-panel')).toBeVisible();
      expect(await background('.chat-panel')).toBe('rgb(35, 30, 24)');
      await checkWidth();
      expect(runtimeErrors).toEqual([]);
    });
  });
}
