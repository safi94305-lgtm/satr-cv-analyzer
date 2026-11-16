const input = document.querySelector('#fileInput');
const dropzone = document.querySelector('#dropzone');
const selected = document.querySelector('#selectedFile');
const analyzeBtn = document.querySelector('#analyzeBtn');
const statusEl = document.querySelector('#status');
const result = document.querySelector('#result');
const analysis = document.querySelector('#analysis');
const rewriteNotice = document.querySelector('#rewriteNotice');
const rewriteMessage = document.querySelector('#rewriteMessage');
const pdfDownload = document.querySelector('#pdfDownload');
const atsScoreEl = document.querySelector('#atsScore');
const atsScoreLabel = document.querySelector('#atsScoreLabel');
const atsMeter = document.querySelector('#atsMeter');
const atsMeterFill = document.querySelector('#atsMeterFill');
const jobDescription = document.querySelector('#jobDescription');
const matchCard = document.querySelector('#matchCard');
const matchScoreEl = document.querySelector('#matchScore');
const matchScoreLabel = document.querySelector('#matchScoreLabel');
const matchMeter = document.querySelector('#matchMeter');
const matchMeterFill = document.querySelector('#matchMeterFill');
const coverLetterPanel = document.querySelector('#coverLetterPanel');
const coverLetterBtn = document.querySelector('#coverLetterBtn');
const coverLetterResult = document.querySelector('#coverLetterResult');
const coverLetterText = document.querySelector('#coverLetterText');
const coverLetterDownload = document.querySelector('#coverLetterDownload');
let currentFile = null;
let currentPdfUrl = null;
let currentLetterPdfUrl = null;

function setStatus(message, kind = '') {
  statusEl.textContent = message;
  statusEl.className = `status ${kind}`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function formatSize(bytes) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function makePdfUrl(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
}

function chooseFile(file) {
  if (!file) return;
  const extension = file.name.split('.').pop().toLowerCase();
  if (!['pdf', 'docx', 'txt'].includes(extension)) {
    currentFile = null;
    analyzeBtn.disabled = true;
    selected.hidden = true;
    setStatus('الصيغ المدعومة حاليًا: PDF وDOCX وTXT.', 'error');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    currentFile = null;
    analyzeBtn.disabled = true;
    selected.hidden = true;
    setStatus('حجم الملف أكبر من 10 ميغابايت.', 'error');
    return;
  }

  currentFile = file;
  selected.hidden = false;
  selected.innerHTML = `<span>الملف المختار</span><strong>${escapeHtml(file.name)} · ${formatSize(file.size)}</strong>`;
  analyzeBtn.disabled = false;
  result.hidden = true;
  matchCard.hidden = true;
  coverLetterPanel.hidden = true;
  setStatus('');
}

input.addEventListener('change', () => chooseFile(input.files[0]));
dropzone.addEventListener('click', event => {
  if (!event.target.closest('label')) input.click();
});
dropzone.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    input.click();
  }
});
for (const eventName of ['dragenter', 'dragover']) {
  dropzone.addEventListener(eventName, event => {
    event.preventDefault();
    dropzone.classList.add('dragging');
  });
}
for (const eventName of ['dragleave', 'drop']) {
  dropzone.addEventListener(eventName, event => {
    event.preventDefault();
    dropzone.classList.remove('dragging');
  });
}
dropzone.addEventListener('drop', event => chooseFile(event.dataTransfer.files[0]));

analyzeBtn.addEventListener('click', async () => {
  if (!currentFile) return;
  analyzeBtn.disabled = true;
  analyzeBtn.innerHTML = 'جاري مراجعة سيرتك… <span aria-hidden="true">↙</span>';
  setStatus('قد يستغرق التحليل بضع ثوانٍ.', 'loading');
  result.hidden = true;
  coverLetterPanel.hidden = true;
  coverLetterResult.hidden = true;
  coverLetterDownload.hidden = true;
  coverLetterDownload.removeAttribute('href');
  rewriteNotice.hidden = true;
  pdfDownload.hidden = true;
  pdfDownload.removeAttribute('href');
  if (currentPdfUrl) {
    URL.revokeObjectURL(currentPdfUrl);
    currentPdfUrl = null;
  }
  if (currentLetterPdfUrl) {
    URL.revokeObjectURL(currentLetterPdfUrl);
    currentLetterPdfUrl = null;
  }

  const body = new FormData();
  body.append('file', currentFile);
  body.append('job_description', jobDescription.value.trim());
  try {
    const response = await fetch('/api/analyze', { method: 'POST', body });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'تعذّر إكمال التحليل. حاول مرة ثانية.');
    const score = Number(data.ats_score);
    if (!Number.isInteger(score) || score < 0 || score > 100) {
      throw new Error('تعذّر قراءة درجة ATS. حاولي التحليل مرة ثانية.');
    }
    if (data.pdf_created && !data.pdf_base64) {
      throw new Error('تعذّر تجهيز النسخة الجديدة. حاولي مرة ثانية.');
    }
    analysis.textContent = data.analysis;
    coverLetterPanel.hidden = !data.has_job_description;
    atsScoreEl.textContent = score;
    atsMeter.setAttribute('aria-valuenow', String(score));
    atsMeterFill.style.width = `${score}%`;
    atsScoreLabel.textContent = score >= 91 ? 'قوية جدًا' : score >= 81 ? 'قوية' : score >= 71 ? 'جيدة' : score >= 51 ? 'تحتاج تحسين' : 'تحتاج مراجعة';
    matchCard.hidden = !data.has_job_description;
    if (data.has_job_description) {
      const matchScore = Number(data.match_score);
      if (!Number.isInteger(matchScore) || matchScore < 0 || matchScore > 100) {
        throw new Error('تعذّر قراءة درجة الملاءمة. حاولي التحليل مرة ثانية.');
      }
      matchScoreEl.textContent = matchScore;
      matchMeter.setAttribute('aria-valuenow', String(matchScore));
      matchMeterFill.style.width = `${matchScore}%`;
      matchScoreLabel.textContent = matchScore >= 85 ? 'تطابق قوي' : matchScore >= 65 ? 'تطابق متوسط' : 'تطابق محدود';
    }
    rewriteNotice.hidden = false;
    if (data.pdf_created) {
      rewriteMessage.textContent = data.has_job_description
        ? data.source_is_arabic
          ? 'جهّزنا نسخة PDF إنجليزية مخصصة للإعلان، مع الحفاظ على المعلومات الموجودة في سيرتك.'
          : 'جهّزنا نسخة PDF مخصصة للإعلان، مع إبراز الخبرات والمهارات المثبتة في سيرتك.'
        : data.source_is_arabic
          ? 'السيرة المرفوعة بالعربية؛ جهّزنا لك نسخة إنجليزية بعمود واحد.'
          : data.reason
            ? `لاحظ التحليل نقاطًا تحتاج ترتيبًا: ${data.reason} جهّزنا نسخة PDF منظّمة.`
            : 'لاحظ التحليل نقاطًا تحتاج ترتيبًا، وجهّزنا نسخة PDF منظّمة.';
      currentPdfUrl = makePdfUrl(data.pdf_base64);
      pdfDownload.href = currentPdfUrl;
      pdfDownload.download = data.pdf_filename || 'satr_ats_resume.pdf';
      pdfDownload.hidden = false;
    } else {
      rewriteMessage.textContent = 'السيرة واضحة ومنظّمة ولا تحتاج إعادة صياغة. راجعي الملاحظات لتحسينها أكثر.';
    }
    result.hidden = false;
    setStatus('اكتملت مراجعة سيرتك.');
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (error) {
    setStatus(error.message || 'تعذّر الاتصال بالخادم. حاول مرة ثانية.', 'error');
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.innerHTML = 'حلّل سيرتي <span aria-hidden="true">↙</span>';
  }
});

coverLetterBtn.addEventListener('click', async () => {
  if (!currentFile) return;
  const description = jobDescription.value.trim();
  if (!description) {
    setStatus('أضيفي وصف الوظيفة أو التدريب أولًا.', 'error');
    return;
  }
  coverLetterBtn.disabled = true;
  coverLetterBtn.textContent = 'جاري كتابة الرسالة…';
  setStatus('نجهّز رسالة إنجليزية من سيرتك والإعلان.', 'loading');
  coverLetterResult.hidden = true;
  coverLetterDownload.hidden = true;
  if (currentLetterPdfUrl) {
    URL.revokeObjectURL(currentLetterPdfUrl);
    currentLetterPdfUrl = null;
  }

  const body = new FormData();
  body.append('file', currentFile);
  body.append('job_description', description);
  try {
    const response = await fetch('/api/cover-letter', { method: 'POST', body });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'تعذّر تجهيز رسالة التقديم. حاولي مرة ثانية.');
    if (!data.cover_letter || !data.pdf_base64) throw new Error('وصلت رسالة غير مكتملة. حاولي مرة ثانية.');
    coverLetterText.textContent = data.cover_letter;
    currentLetterPdfUrl = makePdfUrl(data.pdf_base64);
    coverLetterDownload.href = currentLetterPdfUrl;
    coverLetterDownload.download = data.pdf_filename || 'satr_cover_letter.pdf';
    coverLetterDownload.hidden = false;
    coverLetterResult.hidden = false;
    setStatus('جهّزنا رسالة التقديم. راجعيها وعدّليها قبل الإرسال.');
  } catch (error) {
    setStatus(error.message || 'تعذّر الاتصال بالخادم. حاولي مرة ثانية.', 'error');
  } finally {
    coverLetterBtn.disabled = false;
    coverLetterBtn.textContent = 'اكتب رسالة التقديم';
  }
});

document.querySelector('#copyBtn').addEventListener('click', async event => {
  try {
    await navigator.clipboard.writeText(analysis.textContent);
    event.currentTarget.textContent = 'تم النسخ ✓';
    window.setTimeout(() => { event.currentTarget.textContent = 'انسخ التحليل'; }, 1600);
  } catch {
    setStatus('تعذّر النسخ تلقائيًا. حددي النص وانسخيه يدويًا.', 'error');
  }
});
