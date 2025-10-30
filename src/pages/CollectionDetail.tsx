import { useParams } from 'react-router-dom';
import Shop from './Shop';

const CollectionDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  
  return <Shop collectionSlug={slug} />;
};

export default CollectionDetail;
