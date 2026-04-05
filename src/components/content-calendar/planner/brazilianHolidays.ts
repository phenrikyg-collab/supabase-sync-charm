export interface HolidayDate {
  id: string;
  date: string; // MM-DD or specific date
  label: string;
  included: boolean;
}

// Returns holidays for a given month (1-12)
export function getHolidaysForMonth(month: number, year: number): HolidayDate[] {
  const pad = (n: number) => String(n).padStart(2, '0');
  const m = pad(month);
  const y = year;

  const base: Record<number, { day: number; label: string }[]> = {
    1: [
      { day: 1, label: 'Ano Novo' },
      { day: 22, label: 'Dia Mundial da Moda' },
    ],
    2: [
      { day: 14, label: 'Valentine\'s Day (Internacional)' },
    ],
    3: [
      { day: 8, label: 'Dia Internacional da Mulher' },
      { day: 15, label: 'Dia do Consumidor' },
      { day: 20, label: 'Início do Outono' },
    ],
    4: [
      { day: 21, label: 'Tiradentes' },
    ],
    5: [
      { day: 1, label: 'Dia do Trabalho' },
    ],
    6: [
      { day: 12, label: 'Dia dos Namorados' },
    ],
    7: [
      { day: 20, label: 'Dia do Amigo' },
    ],
    8: [],
    9: [
      { day: 7, label: 'Independência do Brasil' },
      { day: 22, label: 'Início da Primavera' },
    ],
    10: [
      { day: 12, label: 'Dia das Crianças' },
      { day: 15, label: 'Dia do Professor' },
      { day: 31, label: 'Halloween' },
    ],
    11: [
      { day: 2, label: 'Finados' },
      { day: 15, label: 'Proclamação da República' },
      { day: 20, label: 'Dia da Consciência Negra' },
    ],
    12: [
      { day: 25, label: 'Natal' },
      { day: 31, label: 'Réveillon' },
    ],
  };

  // Computed dates
  // Mothers Day = 2nd Sunday of May
  if (month === 5) {
    const firstDay = new Date(y, 4, 1).getDay();
    const motherDay = firstDay === 0 ? 8 : (8 + (7 - firstDay));
    base[5].push({ day: motherDay, label: 'Dia das Mães' });
  }

  // Fathers Day = 2nd Sunday of August
  if (month === 8) {
    const firstDay = new Date(y, 7, 1).getDay();
    const fatherDay = firstDay === 0 ? 8 : (8 + (7 - firstDay));
    base[8].push({ day: fatherDay, label: 'Dia dos Pais' });
  }

  // Semana do Brasil around Sep 7
  if (month === 9) {
    base[9].push({ day: 1, label: 'Semana do Brasil (início)' });
  }

  // Outubro Rosa
  if (month === 10) {
    base[10].push({ day: 1, label: 'Outubro Rosa (início)' });
  }

  // Black Friday = last Friday of November
  if (month === 11) {
    const lastDay = new Date(y, 11, 0).getDate();
    for (let d = lastDay; d >= 1; d--) {
      if (new Date(y, 10, d).getDay() === 5) {
        base[11].push({ day: d, label: 'Black Friday' });
        base[11].push({ day: d + 2 > lastDay ? lastDay : d + 2, label: 'Cyber Monday' });
        break;
      }
    }
  }

  // Carnival (approximation based on Easter)
  if (month === 2 || month === 3) {
    const easter = computeEaster(y);
    const carnival = new Date(easter);
    carnival.setDate(carnival.getDate() - 47);
    if (carnival.getMonth() + 1 === month) {
      base[month].push({ day: carnival.getDate(), label: 'Carnaval' });
    }
    // Easter
    if (easter.getMonth() + 1 === month) {
      base[month].push({ day: easter.getDate(), label: 'Páscoa' });
    }
  }
  if (month === 4) {
    const easter = computeEaster(y);
    if (easter.getMonth() + 1 === 4) {
      base[4].push({ day: easter.getDate(), label: 'Páscoa' });
    }
  }

  const holidays = (base[month] || []).map((h) => ({
    id: `holiday-${m}-${pad(h.day)}`,
    date: `${y}-${m}-${pad(h.day)}`,
    label: h.label,
    included: true,
  }));

  holidays.sort((a, b) => a.date.localeCompare(b.date));
  return holidays;
}

function computeEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
