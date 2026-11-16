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
const interviewPanel = document.querySelector('#interviewPanel');
const generateQuestionsBtn = document.querySelector('#generateQuestionsBtn');
const interviewQuestions = document.querySelector('#interviewQuestions');
const interviewStatus = document.querySelector('#interviewStatus');
const skillPlanPanel = document.querySelector('#skillPlanPanel');
const generateSkillPlanBtn = document.querySelector('#generateSkillPlanBtn');
const skillPlanStatus = document.querySelector('#skillPlanStatus');
const skillPlanSummary = document.querySelector('#skillPlanSummary');
const skillPlanResults = document.querySelector('#skillPlanResults');
let currentFile = null;
let currentPdfUrl = null;
let currentLetterPdfUrl = null;

function setStatus(message, kind = '') {
  statusEl.textContent = message;
  statusEl.className = `status ${kind}`;
}

function setInterviewStatus(message, kind = '') {
  interviewStatus.textContent = message;
  interviewStatus.className = `status interview-status ${kind}`;
}

function setSkillPlanStatus(message, kind = '') {
  skillPlanStatus.textContent = message;
  skillPlanStatus.className = `status skill-plan-status ${kind}`;
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
  interviewPanel.hidden = true;
  skillPlanPanel.hidden = true;
  interviewQuestions.replaceChildren();
  skillPlanResults.replaceChildren();
  skillPlanSummary.hidden = true;
  setInterviewStatus('');
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
  interviewPanel.hidden = true;
  skillPlanPanel.hidden = true;
  interviewQuestions.replaceChildren();
  skillPlanResults.replaceChildren();
  skillPlanSummary.hidden = true;
  setInterviewStatus('');
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
    interviewPanel.hidden = !data.has_job_description;
    skillPlanPanel.hidden = !data.has_job_description;
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

generateQuestionsBtn.addEventListener('click', async () => {
  if (!currentFile) {
    setInterviewStatus('ارفعي السيرة من جديد ثم أعيدي تحليلها مع وصف الوظيفة.', 'error');
    return;
  }
  const description = jobDescription.value.trim();
  if (!description) {
    setInterviewStatus('أضيفي وصف الوظيفة أو التدريب ثم أعيدي التحليل.', 'error');
    return;
  }
  generateQuestionsBtn.disabled = true;
  generateQuestionsBtn.textContent = 'جاري تجهيز الأسئلة…';
  interviewQuestions.replaceChildren();
  setInterviewStatus('جاري تجهيز أسئلة مرتبطة بسيرتك والإعلان…', 'loading');
  setStatus('نجهّز أسئلة مقابلة مرتبطة بالسيرة والإعلان.', 'loading');

  const body = new FormData();
  body.append('file', currentFile);
  body.append('job_description', description);
  try {
    const response = await fetch('/api/interview/questions', { method: 'POST', body });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `الخادم ردّ بالحالة ${response.status}. حدّثي الصفحة أو أعيدي نشر النسخة الأخيرة.`);
    if (!Array.isArray(data.questions) || data.questions.length < 3) {
      throw new Error('وصلت أسئلة غير مكتملة. حاولي مرة ثانية.');
    }
    data.questions.forEach((question, index) => {
      const card = document.createElement('article');
      card.className = 'interview-question-card';
      const heading = document.createElement('div');
      heading.className = 'interview-question-title';
      const number = document.createElement('span');
      number.textContent = String(index + 1).padStart(2, '0');
      const title = document.createElement('h4');
      title.textContent = question;
      heading.append(number, title);

      const answer = document.createElement('textarea');
      answer.className = 'interview-answer';
      answer.maxLength = 4000;
      answer.placeholder = 'اكتبي إجابتك بالإنجليزية…';
      answer.setAttribute('aria-label', `إجابتك عن السؤال ${index + 1}`);

      const evaluate = document.createElement('button');
      evaluate.className = 'button button-light interview-feedback-button';
      evaluate.type = 'button';
      evaluate.dataset.action = 'evaluate-answer';
      evaluate.dataset.question = question;
      evaluate.textContent = 'راجع إجابتي';

      const feedback = document.createElement('div');
      feedback.className = 'interview-feedback';
      feedback.hidden = true;
      card.append(heading, answer, evaluate, feedback);
      interviewQuestions.append(card);
    });
    setInterviewStatus('جهّزنا الأسئلة. اختاري سؤالًا واكتبي إجابتك للتدرّب.');
    setStatus('جهّزنا أسئلة المقابلة.');
  } catch (error) {
    const message = error.message || 'تعذّر الاتصال بالخادم. حاولي مرة ثانية.';
    setInterviewStatus(message, 'error');
    setStatus(message, 'error');
  } finally {
    generateQuestionsBtn.disabled = false;
    generateQuestionsBtn.textContent = 'جهّز أسئلة مخصصة';
  }
});

interviewQuestions.addEventListener('click', async event => {
  const button = event.target.closest('button[data-action="evaluate-answer"]');
  if (!button) return;
  const card = button.closest('.interview-question-card');
  const answer = card.querySelector('.interview-answer').value.trim();
  if (answer.length < 20) {
    card.querySelector('.interview-feedback').textContent = 'اكتبي إجابة أطول قليلًا حتى نقدر نراجعها.';
    card.querySelector('.interview-feedback').hidden = false;
    return;
  }
  const description = jobDescription.value.trim();
  if (!currentFile || !description) {
    setInterviewStatus('ارفعي السيرة وأضيفي وصف الوظيفة ثم أعيدي التحليل.', 'error');
    return;
  }

  button.disabled = true;
  button.textContent = 'جاري مراجعة الإجابة…';
  const body = new FormData();
  body.append('file', currentFile);
  body.append('job_description', description);
  body.append('question', button.dataset.question);
  body.append('answer', answer);
  try {
    const response = await fetch('/api/interview/feedback', { method: 'POST', body });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `الخادم ردّ بالحالة ${response.status}. أعيدي نشر النسخة الأخيرة.`);
    const feedback = card.querySelector('.interview-feedback');
    feedback.replaceChildren();
    const addList = (headingText, items) => {
      if (!Array.isArray(items) || items.length === 0) return;
      const heading = document.createElement('h5');
      heading.textContent = headingText;
      const list = document.createElement('ul');
      items.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        list.append(li);
      });
      feedback.append(heading, list);
    };
    addList('نقاط قوية', data.strengths);
    addList('جرّبي تحسين', data.improve);
    if (data.sample_answer) {
      const heading = document.createElement('h5');
      heading.textContent = 'مثال لصياغة أوضح بالإنجليزية';
      const example = document.createElement('p');
      example.className = 'sample-answer';
      example.textContent = data.sample_answer;
      feedback.append(heading, example);
    }
    feedback.hidden = false;
    setInterviewStatus('وصلتك ملاحظات على إجابتك. استخدميها لتطوير جوابك بصوتك.');
  } catch (error) {
    const feedback = card.querySelector('.interview-feedback');
    feedback.textContent = error.message || 'تعذّر الاتصال بالخادم. حاولي مرة ثانية.';
    feedback.hidden = false;
    setInterviewStatus('تعذّرت مراجعة الإجابة. راجعي الرسالة تحت السؤال.', 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'راجع إجابتي';
  }
});

generateSkillPlanBtn.addEventListener('click', async () => {
  if (!currentFile) {
    setSkillPlanStatus('ارفعي السيرة من جديد ثم أعيدي تحليلها مع وصف الوظيفة.', 'error');
    return;
  }
  const description = jobDescription.value.trim();
  if (!description) {
    setSkillPlanStatus('أضيفي وصف الوظيفة أو التدريب ثم أعيدي التحليل.', 'error');
    return;
  }

  generateSkillPlanBtn.disabled = true;
  generateSkillPlanBtn.textContent = 'جاري بناء الخطة…';
  skillPlanResults.replaceChildren();
  skillPlanSummary.hidden = true;
  setSkillPlanStatus('نقارن متطلبات الإعلان بما ظهر في سيرتك…', 'loading');
  const body = new FormData();
  body.append('file', currentFile);
  body.append('job_description', description);
  try {
    const response = await fetch('/api/skills/plan', { method: 'POST', body });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `الخادم ردّ بالحالة ${response.status}. حدّثي الصفحة أو أعيدي نشر النسخة الأخيرة.`);
    if (!Array.isArray(data.gaps)) throw new Error('وصلت خطة غير مكتملة. حاولي مرة ثانية.');
    skillPlanSummary.textContent = data.summary || 'هذه فرص تعلم مبنية على المتطلبات التي لم يظهر لها دليل كافٍ في السيرة.';
    skillPlanSummary.hidden = false;

    if (data.gaps.length === 0) {
      const complete = document.createElement('p');
      complete.className = 'no-skill-gaps';
      complete.textContent = 'ما ظهرت فجوات رئيسية واضحة في المتطلبات. راجعي الإعلان وتأكدي أن مهاراتك موثقة بأمثلة في سيرتك.';
      skillPlanResults.append(complete);
    }

    data.gaps.forEach((gap, index) => {
      const card = document.createElement('article');
      card.className = 'skill-gap-card';
      const heading = document.createElement('div');
      heading.className = 'skill-gap-heading';
      const number = document.createElement('span');
      number.textContent = String(index + 1).padStart(2, '0');
      const title = document.createElement('h4');
      title.textContent = gap.requirement || 'متطلب من الإعلان';
      heading.append(number, title);
      card.append(heading);

      if (gap.gap_explanation) {
        const note = document.createElement('p');
        note.className = 'skill-gap-explanation';
        note.textContent = gap.gap_explanation;
        card.append(note);
      }

      const columns = document.createElement('div');
      columns.className = 'skill-plan-columns';
      const learning = document.createElement('section');
      learning.className = 'skill-plan-block';
      const learningTitle = document.createElement('h5');
      learningTitle.textContent = 'خطوات التعلم';
      const learningList = document.createElement('ol');
      (Array.isArray(gap.learning_steps) ? gap.learning_steps : []).forEach(step => {
        const item = document.createElement('li');
        item.textContent = step;
        learningList.append(item);
      });
      learning.append(learningTitle, learningList);

      const project = document.createElement('section');
      project.className = 'skill-plan-block skill-project-block';
      const projectTitle = document.createElement('h5');
      projectTitle.textContent = gap.project_title || 'مشروع تدريبي';
      project.append(projectTitle);
      if (gap.project_description) {
        const descriptionText = document.createElement('p');
        descriptionText.textContent = gap.project_description;
        project.append(descriptionText);
      }
      if (Array.isArray(gap.project_deliverables) && gap.project_deliverables.length) {
        const outputLabel = document.createElement('strong');
        outputLabel.className = 'project-output-label';
        outputLabel.textContent = 'مخرجات تقدري تضيفيها لملف أعمالك';
        const outputList = document.createElement('ul');
        gap.project_deliverables.forEach(deliverable => {
          const item = document.createElement('li');
          item.textContent = deliverable;
          outputList.append(item);
        });
        project.append(outputLabel, outputList);
      }
      columns.append(learning, project);
      card.append(columns);

      if (gap.resource && gap.resource.url && gap.resource.title) {
        try {
          const resourceUrl = new URL(gap.resource.url);
          if (resourceUrl.protocol === 'https:') {
            const resource = document.createElement('a');
            resource.className = 'skill-resource-link';
            resource.href = resourceUrl.href;
            resource.target = '_blank';
            resource.rel = 'noopener noreferrer';
            resource.textContent = `افتحي المصدر: ${gap.resource.title} · ${gap.resource.provider || 'مصدر تعليمي'}`;
            card.append(resource);
          }
        } catch { /* Ignore malformed resource URLs. */ }
      }
      skillPlanResults.append(card);
    });

    setSkillPlanStatus(data.gaps.length ? 'جهّزنا خطتك. ابدئي بالأولوية الأولى وأضيفي المشروع لملف أعمالك بعد إنجازه.' : 'اكتمل التقييم.');
  } catch (error) {
    setSkillPlanStatus(error.message || 'تعذّر بناء الخطة. حاولي مرة ثانية.', 'error');
  } finally {
    generateSkillPlanBtn.disabled = false;
    generateSkillPlanBtn.textContent = 'ابني خطتي';
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

const applicationForm = document.querySelector('#applicationForm');
const applicationCompany = document.querySelector('#applicationCompany');
const applicationRole = document.querySelector('#applicationRole');
const applicationDate = document.querySelector('#applicationDate');
const applicationStatus = document.querySelector('#applicationStatus');
const applicationLink = document.querySelector('#applicationLink');
const applicationSave = document.querySelector('#applicationSave');
const applicationCancel = document.querySelector('#applicationCancel');
const applicationFormTitle = document.querySelector('#applicationFormTitle');
const applicationFilter = document.querySelector('#applicationFilter');
const applicationList = document.querySelector('#applicationList');
const applicationEmpty = document.querySelector('#applicationEmpty');
const applicationStats = document.querySelector('#applicationStats');
const trackerStatus = document.querySelector('#trackerStatus');
const APPLICATION_STORAGE_KEY = 'satr_application_tracker_v1';
const APPLICATION_STATUS_LABELS = {
  interested: 'مهتمة', applied: 'قدّمت', interview: 'مقابلة', offer: 'عرض وظيفي', closed: 'مغلقة'
};
let applications = [];
let editingApplicationId = null;

function setTrackerStatus(message, kind = '') {
  trackerStatus.textContent = message;
  trackerStatus.className = `tracker-status ${kind}`;
}

function todayLocal() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function loadApplications() {
  try {
    const saved = JSON.parse(localStorage.getItem(APPLICATION_STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter(item =>
      item && typeof item.id === 'string' && typeof item.company === 'string' &&
      typeof item.role === 'string' && typeof item.date === 'string' &&
      Object.hasOwn(APPLICATION_STATUS_LABELS, item.status)
    ) : [];
  } catch {
    setTrackerStatus('تعذّر قراءة السجل المحفوظ في هذا المتصفح.', 'error');
    return [];
  }
}

function persistApplications(nextApplications) {
  try {
    localStorage.setItem(APPLICATION_STORAGE_KEY, JSON.stringify(nextApplications));
    return true;
  } catch {
    setTrackerStatus('تعذّر الحفظ في المتصفح. تحققي من مساحة التخزين أو إعدادات الخصوصية.', 'error');
    return false;
  }
}

function makeTrackerElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function formatApplicationDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ar', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

function renderApplicationStats() {
  const metrics = [
    ['كل الفرص', applications.length],
    ['قدّمت', applications.filter(item => item.status === 'applied').length],
    ['مقابلات', applications.filter(item => item.status === 'interview').length],
    ['عروض', applications.filter(item => item.status === 'offer').length],
  ];
  applicationStats.replaceChildren();
  metrics.forEach(([label, value]) => {
    const metric = makeTrackerElement('div', 'application-stat');
    metric.append(makeTrackerElement('strong', '', String(value)), makeTrackerElement('span', '', label));
    applicationStats.append(metric);
  });
}

function renderApplications() {
  renderApplicationStats();
  applicationList.replaceChildren();
  const filter = applicationFilter.value;
  const visible = applications
    .filter(item => filter === 'all' || item.status === filter)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  applicationEmpty.hidden = visible.length > 0;
  applicationEmpty.textContent = applications.length === 0
    ? 'لسه ما أضفتِ تقديمات. سجّلي أول فرصة من النموذج.'
    : 'ما في تقديمات بهذه الحالة.';

  visible.forEach(item => {
    const card = makeTrackerElement('article', 'application-card');
    const main = makeTrackerElement('div', 'application-card-main');
    const title = makeTrackerElement('h5', '', item.role);
    const company = makeTrackerElement('p', 'application-company', item.company);
    const date = makeTrackerElement('time', 'application-date', formatApplicationDate(item.date));
    date.dateTime = item.date;
    main.append(title, company, date);

    const actions = makeTrackerElement('div', 'application-card-actions');
    const status = makeTrackerElement('span', `application-status-chip status-${item.status}`, APPLICATION_STATUS_LABELS[item.status]);
    const buttons = makeTrackerElement('div', 'application-row-buttons');
    if (item.link) {
      try {
        const url = new URL(item.link);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          const link = makeTrackerElement('a', 'application-link', 'رابط الإعلان');
          link.href = url.href;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          buttons.append(link);
        }
      } catch { /* Ignore invalid links in older saved entries. */ }
    }
    const edit = makeTrackerElement('button', 'tracker-row-action', 'تعديل');
    edit.type = 'button';
    edit.dataset.action = 'edit';
    edit.dataset.id = item.id;
    const remove = makeTrackerElement('button', 'tracker-row-action tracker-delete-action', 'حذف');
    remove.type = 'button';
    remove.dataset.action = 'delete';
    remove.dataset.id = item.id;
    buttons.append(edit, remove);
    actions.append(status, buttons);
    card.append(main, actions);
    applicationList.append(card);
  });
}

function clearApplicationForm() {
  editingApplicationId = null;
  applicationForm.reset();
  applicationDate.value = todayLocal();
  applicationStatus.value = 'applied';
  applicationFormTitle.textContent = 'أضيفي تقديمًا';
  applicationSave.textContent = 'حفظ التقديم';
  applicationCancel.hidden = true;
  setTrackerStatus('');
}

applicationDate.value = todayLocal();
applications = loadApplications();
renderApplications();

applicationForm.addEventListener('submit', event => {
  event.preventDefault();
  if (!applicationForm.reportValidity()) return;
  const existing = applications.find(item => item.id === editingApplicationId);
  const record = {
    id: existing?.id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`),
    company: applicationCompany.value.trim(),
    role: applicationRole.value.trim(),
    date: applicationDate.value,
    status: applicationStatus.value,
    link: applicationLink.value.trim(),
    updatedAt: new Date().toISOString(),
  };
  const next = existing
    ? applications.map(item => item.id === existing.id ? record : item)
    : [...applications, record];
  if (!persistApplications(next)) return;
  applications = next;
  renderApplications();
  clearApplicationForm();
  setTrackerStatus(existing ? 'تم تحديث التقديم.' : 'تم حفظ التقديم على هذا الجهاز.');
});

applicationCancel.addEventListener('click', clearApplicationForm);
applicationFilter.addEventListener('change', renderApplications);

applicationList.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const record = applications.find(item => item.id === button.dataset.id);
  if (!record) return;

  if (button.dataset.action === 'edit') {
    editingApplicationId = record.id;
    applicationCompany.value = record.company;
    applicationRole.value = record.role;
    applicationDate.value = record.date;
    applicationStatus.value = record.status;
    applicationLink.value = record.link || '';
    applicationFormTitle.textContent = 'عدّلي بيانات التقديم';
    applicationSave.textContent = 'حفظ التعديل';
    applicationCancel.hidden = false;
    setTrackerStatus('');
    applicationForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    applicationCompany.focus({ preventScroll: true });
  } else if (button.dataset.action === 'delete') {
    if (!window.confirm(`تحذفي تقديم ${record.role} لدى ${record.company}؟`)) return;
    const next = applications.filter(item => item.id !== record.id);
    if (!persistApplications(next)) return;
    applications = next;
    renderApplications();
    if (editingApplicationId === record.id) clearApplicationForm();
    setTrackerStatus('تم حذف التقديم.');
  }
});

window.addEventListener('storage', event => {
  if (event.key !== APPLICATION_STORAGE_KEY) return;
  applications = loadApplications();
  renderApplications();
});
