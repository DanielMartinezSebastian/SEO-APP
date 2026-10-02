// Proyectos: un sitio con varios targets, cada uno con sus estudios. Como studyService, es la única capa que
// toca los archivos y la usan la API, la CLI y el servidor MCP.
import fs from 'fs/promises';
import path from 'path';
import { randomBytes, randomUUID } from 'crypto';
import { RESULTS_DIR } from '../config.js';
import { buildProjectView, projectToMarkdown } from '../../shared/project.js';
import { auditSite } from './siteAuditService.js';
import { NotFoundError, createStudy, getStudy } from './studyService.js';
import { ValidationError, isReportJson, parseStudyMeta } from '../utils/validation.js';

const PROJECT_FILE = /^seo_project_[a-f0-9]{8}\.json$/;
const fileOf = (id) => {
  if (typeof id !== 'string' || !/^[a-f0-9]{8}$/.test(id)) throw new ValidationError('Identificador de proyecto inválido');
  return path.join(RESULTS_DIR, `seo_project_${id}.json`);
};

const text = (value, max, label) => {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new ValidationError(`${label} debe ser texto`);
  if (value.length > max) throw new ValidationError(`${label} admite como máximo ${max} caracteres`);
  return value.trim();
};

async function read(id) {
  try {
    return JSON.parse(await fs.readFile(fileOf(id), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') throw new NotFoundError('Proyecto no encontrado');
    throw error;
  }
}

async function write(project) {
  await fs.mkdir(RESULTS_DIR, { recursive: true });
  await fs.writeFile(fileOf(project.id), JSON.stringify({ ...project, updatedAt: new Date().toISOString() }, null, 2));
  return project;
}

// Los estudios de los targets, ya leídos. Uno que se haya borrado no rompe el proyecto: se señala en la vista
async function loadStudies(project) {
  const filenames = [...new Set(project.targets.flatMap((target) => target.studies))];
  const loaded = await Promise.all(filenames.map(async (filename) => {
    try {
      const { report, study } = await getStudy(filename);
      return { filename, report, study };
    } catch {
      return null;
    }
  }));
  return loaded.filter(Boolean);
}

const summary = (project, view) => ({
  id: project.id,
  name: project.name,
  client: project.client,
  site: project.site,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
  targets: view.targets.map((target) => ({ name: target.name, priority: target.priority, volume: target.totals.volume, studies: target.studies.length })),
  totals: view.totals,
  siteScore: project.siteAudit?.score ?? null
});

export async function listProjects() {
  let files = [];
  try {
    files = await fs.readdir(RESULTS_DIR);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const projects = await Promise.all(files.filter((name) => PROJECT_FILE.test(name)).map(async (name) => {
    const project = await read(name.slice('seo_project_'.length, -'.json'.length));
    return summary(project, buildProjectView(project, await loadStudies(project)));
  }));
  return projects.sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
}

// Acepta el identificador o «latest»
export async function resolveProject(reference) {
  if (reference && reference !== 'latest' && reference !== 'ultimo') return reference;
  const [latest] = await listProjects();
  if (!latest) throw new NotFoundError('No hay proyectos todavía');
  return latest.id;
}

/** @param {{ name: string, client?: string, site?: string, author?: string, notes?: string }} input */
export async function createProject(input) {
  const meta = parseStudyMeta(input);
  if (!meta.name) throw new ValidationError('El proyecto necesita un nombre');
  return write({ id: randomBytes(4).toString('hex'), ...meta, createdAt: new Date().toISOString(), targets: [], siteUrls: null, siteAudit: null });
}

export async function getProject(id) {
  const project = await read(id);
  return { project, view: buildProjectView(project, await loadStudies(project)) };
}

export async function updateProject(id, input) {
  const project = await read(id);
  const meta = parseStudyMeta({ ...project, ...input });
  if (!meta.name) throw new ValidationError('El proyecto necesita un nombre');
  // al cambiar de sitio, su sitemap y su auditoría dejan de valer
  const siteChanged = meta.site !== project.site;
  return write({ ...project, ...meta, ...(siteChanged ? { siteUrls: null, siteAudit: null } : {}) });
}

// Borra el proyecto; sus estudios se conservan (siguen sirviendo por separado)
export async function deleteProject(id) {
  try {
    await fs.unlink(fileOf(id));
  } catch (error) {
    if (error.code === 'ENOENT') throw new NotFoundError('Proyecto no encontrado');
    throw error;
  }
  return { id };
}

function parseTarget(input, current = {}) {
  const target = {
    name: input?.name !== undefined ? text(input.name, 80, 'El nombre del target') : current.name,
    audience: input?.audience !== undefined ? text(input.audience, 400, 'El público') : current.audience || '',
    // ruta o URL de la página de aterrizaje, si ya se sabe cuál es
    page: input?.page !== undefined ? text(input.page, 300, 'La página') : current.page || ''
  };
  if (!target.name) throw new ValidationError('El target necesita un nombre (el público o la línea de negocio)');
  return target;
}

async function checkStudies(filenames) {
  if (!Array.isArray(filenames)) throw new ValidationError('studies debe ser una lista de nombres de archivo de estudio');
  for (const filename of filenames) {
    if (!isReportJson(filename)) throw new ValidationError(`Nombre de estudio inválido: ${filename}`);
    await getStudy(filename);
  }
  return [...new Set(filenames)];
}

/**
 * Añade un target. Con `keywords` crea su estudio (unos 5 s por keyword) heredando cliente y sitio del proyecto;
 * con `studies` enlaza estudios que ya existen.
 * @param {{ name: string, audience?: string, page?: string, keywords?: string[], studies?: string[], country?: string, language?: string }} input
 */
export async function addTarget(id, input) {
  const project = await read(id);
  const target = parseTarget(input);
  if (project.targets.some((other) => other.name.toLowerCase() === target.name.toLowerCase())) {
    throw new ValidationError(`Ya hay un target llamado «${target.name}»`);
  }
  const studies = await checkStudies(input?.studies || []);
  if (input?.keywords?.length) {
    const created = await createStudy({
      keywords: input.keywords, country: input.country, language: input.language,
      name: `${project.name} · ${target.name}`, client: project.client, site: project.site, author: project.author
    });
    studies.push(created.filename);
  }
  project.targets.push({ id: randomUUID().slice(0, 8), ...target, studies });
  await write(project);
  return getProject(id);
}

export async function updateTarget(id, targetId, input) {
  const project = await read(id);
  const index = project.targets.findIndex((target) => target.id === targetId);
  if (index === -1) throw new NotFoundError('Target no encontrado');
  const current = project.targets[index];
  project.targets[index] = {
    ...current,
    ...parseTarget(input, current),
    studies: input?.studies !== undefined ? await checkStudies(input.studies) : current.studies
  };
  await write(project);
  return getProject(id);
}

// Quita el target del proyecto; sus estudios se conservan
export async function removeTarget(id, targetId) {
  const project = await read(id);
  if (!project.targets.some((target) => target.id === targetId)) throw new NotFoundError('Target no encontrado');
  project.targets = project.targets.filter((target) => target.id !== targetId);
  await write(project);
  return getProject(id);
}

// Audita el sitio del proyecto por su sitemap: da las URLs con las que se sitúa cada target
export async function runProjectSiteAudit(id, { allowLocal = false, pages } = {}) {
  const project = await read(id);
  if (!project.site) throw new ValidationError('Indica primero el sitio del proyecto (ejemplo.com o localhost:3000)');
  const { urls, ...result } = await auditSite(project.site, { allowLocal, pages });
  const previous = project.siteAudit;
  project.siteAudit = { ...result, changes: previous ? { previousAt: previous.fetchedAt, previousScore: previous.score, scoreDelta: result.score - previous.score } : null };
  project.siteUrls = { fetchedAt: result.fetchedAt, urls, total: result.sitemap.total };
  await write(project);
  return getProject(id);
}

export async function exportProjectMarkdown(id) {
  const { project, view } = await getProject(id);
  return projectToMarkdown(project, view);
}
