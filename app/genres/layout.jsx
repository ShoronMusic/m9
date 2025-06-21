import Layout from "../components/Layout";
import styles from "./GenresPage.module.css";

export const metadata = {
  title: "Genres | Music8",
  description: "Browse and explore different music genres on Music8.",
};

export default function GenresLayout({ children }) {
  return (
    <Layout pageTitle="Genres">
      <div className={styles.genresContainer}>{children}</div>
    </Layout>
  );
}
