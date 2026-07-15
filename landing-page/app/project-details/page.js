"use client";

import NextLayout from "@/layouts/NextLayout";
import Link from "next/link";
import { useSettings } from "@/components/SettingsProvider";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const ProjectDetailsContent = () => {
  const { projects, resolveImageUrl } = useSettings();
  const searchParams = useSearchParams();
  const id = searchParams ? searchParams.get("id") : null;

  const project = projects.find((p) => p.id === id);

  if (!project) {
    return (
      <section className="project-details-section fix section-padding text-center">
        <div className="container py-5">
          <h2>Project not found</h2>
          <Link href="/project" className="theme-btn mt-4">
            Back to Projects
          </Link>
        </div>
      </section>
    );
  }

  // Split sections to display some before the bottom gallery and some after
  const firstSections = project.sections ? project.sections.slice(0, 2) : [];
  const remainingSections = project.sections ? project.sections.slice(2) : [];

  return (
    <>

      <section className="project-details-section fix section-padding">
        <div className="container">
          <div className="project-details-wrapper">
            <div className="row g-4 justify-content-between">
              {/* Top Gallery Images */}
              <div className="col-lg-8">
                <div className="project-details-image">
                  <img
                    src={resolveImageUrl(project.imageUrl) || "/assets/img/project/details-1.jpg"}
                    alt="img"
                    style={{ width: "100%", height: "450px", objectFit: "cover", borderRadius: "10px" }}
                  />
                </div>
              </div>
              <div className="col-lg-4">
                <div className="project-details-image">
                  <img
                    src={resolveImageUrl(project.imageUrl2) || "/assets/img/project/details-2.jpg"}
                    alt="img"
                    style={{ width: "100%", height: "450px", objectFit: "cover", borderRadius: "10px" }}
                  />
                </div>
              </div>

              {/* Main Content Area */}
              <div className="col-lg-7">
                <div className="project-details-content">
                  <h5>{project.category}</h5>
                  <h2>{project.title}</h2>
                  <p className="mt-4 whitespace-pre-line">{project.description}</p>

                  {/* Render First 2 Sections */}
                  {firstSections.map((sec, index) => (
                    <div key={index} className="mt-50">
                      <h4>{sec.title}</h4>
                      {sec.content && <p className="mt-3">{sec.content}</p>}
                      {sec.bullets && sec.bullets.length > 0 && (
                        <ul className="project-list mt-3">
                          {sec.bullets.map((bullet, bIndex) => (
                            <li key={bIndex}>
                              <i className="far fa-check" />
                              {bullet}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Sidebar Info Card */}
              <div className="col-lg-5">
                <div className="project-information">
                  <h4>Project Information's</h4>
                  <ul>
                    <li>
                      Clients <span>{project.clientName || "N/A"}</span>
                    </li>
                    <li>
                      Category <span>{project.category}</span>
                    </li>
                    <li>
                      Date <span>{project.projectDate || "N/A"}</span>
                    </li>
                    <li>
                      Location <span>{project.location || "N/A"}</span>
                    </li>
                    <li>
                      Duration <span>{project.duration || "N/A"}</span>
                    </li>
                  </ul>
                  <div className="social-icon d-flex align-items-center">
                    <h5>Project Share</h5>
                    <div className="icon">
                      <a href="#">
                        <i className="fab fa-facebook-f" />
                      </a>
                      <a href="#">
                        <i className="fab fa-twitter" />
                      </a>
                      <a href="#">
                        <i className="fab fa-vimeo-v" />
                      </a>
                      <a href="#">
                        <i className="fab fa-pinterest-p" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Gallery (Images 3 & 4) */}
            {(project.imageUrl3 || project.imageUrl4) && (
              <div className="project-details-img mt-50">
                <div className="row g-4">
                  {project.imageUrl3 && (
                    <div className="col-lg-6">
                      <div className="thumb">
                        <img 
                          src={resolveImageUrl(project.imageUrl3)} 
                          alt="img" 
                          style={{ width: "100%", height: "350px", objectFit: "cover", borderRadius: "10px" }}
                        />
                      </div>
                    </div>
                  )}
                  {project.imageUrl4 && (
                    <div className="col-lg-6">
                      <div className="thumb">
                        <img 
                          src={resolveImageUrl(project.imageUrl4)} 
                          alt="img" 
                          style={{ width: "100%", height: "350px", objectFit: "cover", borderRadius: "10px" }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Remaining Sections after Bottom Gallery */}
            {remainingSections.length > 0 && (
              <div className="mt-50">
                {remainingSections.map((sec, index) => (
                  <div key={index} className="mt-4">
                    <h4 className="mb-3">{sec.title}</h4>
                    {sec.content && <p className="mt-3">{sec.content}</p>}
                    {sec.bullets && sec.bullets.length > 0 && (
                      <ul className="p-list mt-3">
                        {sec.bullets.map((bullet, bIndex) => (
                          <li key={bIndex}>
                            <i className="far fa-check" />
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
      
      {/* Other Projects Gallery */}
      <section className="project-section section-padding pt-0 mt-5">
        <div className="container">
          <div className="section-title text-center">
            <span className="sub-content">
              <img src="/assets/img/bale.png" alt="img" />
              Work Gallery
            </span>
            <h2>Explore Other Projects</h2>
          </div>
          <div className="row justify-content-center">
            <div className="col-lg-9">
              <div className="row justify-content-center">
                {projects.filter((p) => p.id !== project.id).slice(0, 2).map((otherProject, index) => (
                  <div key={otherProject.id} className="col-lg-6 col-md-6">
                    <div className="project-card-items">
                      <div className="project-image">
                        <img src={resolveImageUrl(otherProject.imageUrl)} alt={otherProject.title} style={{ height: '300px', objectFit: 'cover' }} />
                      </div>
                      <div className="project-content">
                        <p>{otherProject.category}</p>
                        <h3>
                          <Link href={`/project-details?id=${otherProject.id}`}>
                            {otherProject.title}
                          </Link>
                        </h3>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

const ProjectDetailsPage = () => {
  return (
    <NextLayout>
      <Suspense fallback={
        <div className="text-center py-5">
          <p>Loading project details...</p>
        </div>
      }>
        <ProjectDetailsContent />
      </Suspense>
    </NextLayout>
  );
};

export default ProjectDetailsPage;
