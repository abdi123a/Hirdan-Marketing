"use client";

import NextLayout from "@/layouts/NextLayout";
import Link from "next/link";
import { useSettings } from "@/components/SettingsProvider";

const ProjectPage = () => {
  const { projects, resolveImageUrl } = useSettings();

  return (
    <NextLayout>

      <section className="project-section fix section-padding">
        <div className="container">
          <div className="section-title text-center">
            <span className="sub-content wow fadeInUp">
              <img src="assets/img/bale.png" alt="img" />
              Work Gallery
            </span>
            <h2 className="wow fadeInUp" data-wow-delay=".3s">
              Explore Featured Projects
            </h2>
          </div>
          <div className="row justify-content-center">
            <div className="col-lg-9">
              <div className="row justify-content-center">
                {projects && projects.length > 0 ? (
                  projects.map((project, index) => (
                    <div
                      key={project.id}
                      className="col-xl-6 col-lg-6 col-md-6 wow fadeInUp"
                      data-wow-delay={`${0.3 + (index % 2) * 0.2}s`}
                    >
                      <div className="project-card-items">
                        <div className="project-image">
                          <img src={resolveImageUrl(project.imageUrl) || "assets/img/project/05.jpg"} alt={project.title} style={{ height: '300px', objectFit: 'cover' }} />
                        </div>
                        <div className="project-content">
                          <p>{project.category}</p>
                          <h3>
                            <Link href={`/project-details?id=${project.id}`}>
                              {project.title}
                            </Link>
                          </h3>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-12 text-center py-5">
                    <p className="text-muted">No projects found. Check back later!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </NextLayout>
  );
};

export default ProjectPage;
